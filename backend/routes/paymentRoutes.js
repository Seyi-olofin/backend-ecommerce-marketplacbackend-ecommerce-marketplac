const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Paystack configuration
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY || 'sk_test_your_paystack_secret_key_here';
const PAYSTACK_PUBLIC_KEY = process.env.PAYSTACK_PUBLIC_KEY || 'pk_test_your_paystack_public_key_here';

// Initialize payment
router.post('/paystack/initialize', async (req, res) => {
  try {
    const { amount, email, orderId, currency = 'NGN' } = req.body;

    // Convert amount to kobo (Paystack expects amount in smallest currency unit)
    const amountInKobo = Math.round(amount * 100);

    const response = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amountInKobo,
        email,
        reference: orderId,
        currency,
        callback_url: `${process.env.FRONTEND_URL || 'http://localhost:8081'}/payment/callback`,
        metadata: {
          order_id: orderId,
          custom_fields: [
            {
              display_name: "Order ID",
              variable_name: "order_id",
              value: orderId
            }
          ]
        }
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Paystack initialization failed:', data);
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Payment initialization failed'
      });
    }

    res.json({
      success: true,
      data: data.data
    });

  } catch (error) {
    console.error('Payment initialization error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Verify payment
router.get('/paystack/verify/:reference', async (req, res) => {
  try {
    const { reference } = req.params;

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Paystack verification failed:', data);
      return res.status(response.status).json({
        success: false,
        message: data.message || 'Payment verification failed'
      });
    }

    res.json({
      success: true,
      data: data.data
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Paystack webhook handler
router.post('/paystack/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    // Verify webhook signature
    const secret = PAYSTACK_SECRET_KEY;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      console.error('Invalid webhook signature');
      return res.status(400).send('Invalid signature');
    }

    const event = req.body;

    console.log('Paystack webhook received:', event.event);

    switch (event.event) {
      case 'charge.success':
        await handleSuccessfulPayment(event.data);
        break;

      case 'charge.failure':
        await handleFailedPayment(event.data);
        break;

      case 'transfer.success':
        await handleTransferSuccess(event.data);
        break;

      case 'transfer.failed':
        await handleTransferFailed(event.data);
        break;

      default:
        console.log('Unhandled webhook event:', event.event);
    }

    res.status(200).send('Webhook received');

  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).send('Webhook processing failed');
  }
});

// Handle successful payment
async function handleSuccessfulPayment(paymentData) {
  try {
    const { reference, amount, customer, metadata } = paymentData;
    const orderId = metadata?.order_id || reference;

    console.log(`Payment successful for order: ${orderId}, amount: ${amount}`);

    // Update order status in database
    const Order = require('../models/Order');
    const order = await Order.findOneAndUpdate(
      { orderNumber: orderId },
      {
        status: 'paid',
        paymentStatus: 'completed',
        paymentReference: reference,
        paymentAmount: amount / 100, // Convert from kobo
        paymentDate: new Date(),
        updatedAt: new Date()
      },
      { new: true }
    );

    if (order) {
      console.log(`Order ${orderId} updated to paid status`);

      // Send notification to admin
      try {
        await fetch('http://localhost:5000/api/notifications/payment-received', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId: orderId,
            amount: (amount / 100).toFixed(2),
            paymentMethod: 'Paystack',
            customerName: `${order.shippingAddress?.firstName || 'Customer'} ${order.shippingAddress?.lastName || ''}`.trim()
          })
        });
        console.log(`Admin notification sent for payment: ${orderId}`);
      } catch (notificationError) {
        console.error('Failed to send admin notification:', notificationError);
      }

    } else {
      console.error(`Order ${orderId} not found for payment update`);
    }

  } catch (error) {
    console.error('Error handling successful payment:', error);
  }
}

// Handle failed payment
async function handleFailedPayment(paymentData) {
  try {
    const { reference, metadata } = paymentData;
    const orderId = metadata?.order_id || reference;

    console.log(`Payment failed for order: ${orderId}`);

    // Update order status
    const Order = require('../models/Order');
    await Order.findOneAndUpdate(
      { orderNumber: orderId },
      {
        paymentStatus: 'failed',
        updatedAt: new Date()
      }
    );

  } catch (error) {
    console.error('Error handling failed payment:', error);
  }
}

// Handle transfer success (for payouts)
async function handleTransferSuccess(transferData) {
  console.log('Transfer successful:', transferData);
  // Handle supplier payouts here
}

// Handle transfer failed (for payouts)
async function handleTransferFailed(transferData) {
  console.log('Transfer failed:', transferData);
  // Handle failed payouts here
}

// Get payment methods available
router.get('/methods', (req, res) => {
  res.json({
    success: true,
    methods: [
      {
        id: 'paystack',
        name: 'Paystack',
        description: 'Pay with card, bank transfer, or mobile money',
        currencies: ['NGN', 'USD', 'GHS', 'KES', 'ZAR'],
        countries: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'International']
      },
      {
        id: 'stripe',
        name: 'Stripe',
        description: 'Global payment processing',
        currencies: ['USD', 'EUR', 'GBP'],
        countries: ['International']
      },
      {
        id: 'flutterwave',
        name: 'Flutterwave',
        description: 'African payment solutions',
        currencies: ['NGN', 'USD', 'GHS', 'KES', 'ZAR', 'XAF', 'XOF'],
        countries: ['Nigeria', 'Ghana', 'Kenya', 'South Africa', 'Cameroon', 'Senegal']
      }
    ]
  });
});

module.exports = router;
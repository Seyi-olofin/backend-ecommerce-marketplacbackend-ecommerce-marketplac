const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const twilio = require('twilio');

// Email configuration
const emailTransporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// SMS configuration (Twilio)
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Notification preferences storage (in production, use database)
let adminNotificationSettings = {
  email: process.env.ADMIN_EMAIL || 'seyi@luxemart.com',
  phone: process.env.ADMIN_PHONE || '+23408169342939',
  emailNotifications: true,
  smsNotifications: true,
  newOrderAlerts: true,
  paymentAlerts: true,
  lowStockAlerts: true
};

// Get notification settings
router.get('/settings', (req, res) => {
  res.json({
    success: true,
    settings: adminNotificationSettings
  });
});

// Update notification settings
router.put('/settings', (req, res) => {
  const { email, phone, emailNotifications, smsNotifications, newOrderAlerts, paymentAlerts, lowStockAlerts } = req.body;

  adminNotificationSettings = {
    ...adminNotificationSettings,
    email: email || adminNotificationSettings.email,
    phone: phone || adminNotificationSettings.phone,
    emailNotifications: emailNotifications !== undefined ? emailNotifications : adminNotificationSettings.emailNotifications,
    smsNotifications: smsNotifications !== undefined ? smsNotifications : adminNotificationSettings.smsNotifications,
    newOrderAlerts: newOrderAlerts !== undefined ? newOrderAlerts : adminNotificationSettings.newOrderAlerts,
    paymentAlerts: paymentAlerts !== undefined ? paymentAlerts : adminNotificationSettings.paymentAlerts,
    lowStockAlerts: lowStockAlerts !== undefined ? lowStockAlerts : adminNotificationSettings.lowStockAlerts
  };

  res.json({
    success: true,
    message: 'Notification settings updated',
    settings: adminNotificationSettings
  });
});

// Send email notification
async function sendEmailNotification(to, subject, htmlContent, textContent) {
  try {
    if (!adminNotificationSettings.emailNotifications) {
      console.log('Email notifications disabled');
      return;
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: to,
      subject: subject,
      html: htmlContent,
      text: textContent
    };

    const result = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', result.messageId);
    return result;
  } catch (error) {
    console.error('Email sending failed:', error);
    throw error;
  }
}

// Send SMS notification
async function sendSMSNotification(to, message) {
  try {
    if (!adminNotificationSettings.smsNotifications) {
      console.log('SMS notifications disabled');
      return;
    }

    const result = await twilioClient.messages.create({
      body: message,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: to
    });

    console.log('SMS sent successfully:', result.sid);
    return result;
  } catch (error) {
    console.error('SMS sending failed:', error);
    throw error;
  }
}

// New order notification
router.post('/new-order', async (req, res) => {
  try {
    const { orderId, customerName, total, paymentMethod } = req.body;

    const subject = `🆕 New Order Received - ${orderId}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">New Order Alert!</h2>
        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Total:</strong> $${total}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${process.env.ADMIN_DASHBOARD_URL || 'http://localhost:8083'}/orders"
             style="background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">
            View Order Details
          </a>
        </div>
      </div>
    `;

    const textContent = `New Order Alert!\nOrder ID: ${orderId}\nCustomer: ${customerName}\nTotal: $${total}\nPayment Method: ${paymentMethod}\nTime: ${new Date().toLocaleString()}`;

    // Send email notification
    if (adminNotificationSettings.emailNotifications && adminNotificationSettings.newOrderAlerts) {
      await sendEmailNotification(adminNotificationSettings.email, subject, htmlContent, textContent);
    }

    // Send SMS notification for high-value orders
    if (adminNotificationSettings.smsNotifications && adminNotificationSettings.newOrderAlerts && parseFloat(total) > 100) {
      const smsMessage = `🆕 New Order: ${orderId} - $${total} from ${customerName}`;
      await sendSMSNotification(adminNotificationSettings.phone, smsMessage);
    }

    res.json({ success: true, message: 'New order notifications sent' });

  } catch (error) {
    console.error('New order notification failed:', error);
    res.status(500).json({ success: false, message: 'Failed to send notifications' });
  }
});

// Payment received notification
router.post('/payment-received', async (req, res) => {
  try {
    const { orderId, amount, paymentMethod, customerName } = req.body;

    const subject = `💰 Payment Received - ${orderId}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #059669;">Payment Received!</h2>
        <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #059669;">
          <p><strong>Order ID:</strong> ${orderId}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Amount:</strong> $${amount}</p>
          <p><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #059669; font-weight: bold;">✅ Order is ready for fulfillment!</p>
      </div>
    `;

    const textContent = `Payment Received!\nOrder ID: ${orderId}\nCustomer: ${customerName}\nAmount: $${amount}\nPayment Method: ${paymentMethod}\nTime: ${new Date().toLocaleString()}`;

    // Send email notification
    if (adminNotificationSettings.emailNotifications && adminNotificationSettings.paymentAlerts) {
      await sendEmailNotification(adminNotificationSettings.email, subject, htmlContent, textContent);
    }

    // Send SMS notification
    if (adminNotificationSettings.smsNotifications && adminNotificationSettings.paymentAlerts) {
      const smsMessage = `💰 Payment: ${orderId} - $${amount} received`;
      await sendSMSNotification(adminNotificationSettings.phone, smsMessage);
    }

    res.json({ success: true, message: 'Payment notifications sent' });

  } catch (error) {
    console.error('Payment notification failed:', error);
    res.status(500).json({ success: false, message: 'Failed to send notifications' });
  }
});

// Low stock alert
router.post('/low-stock', async (req, res) => {
  try {
    const { productName, productId, currentStock, threshold } = req.body;

    const subject = `⚠️ Low Stock Alert - ${productName}`;
    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #dc2626;">Low Stock Alert!</h2>
        <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
          <p><strong>Product:</strong> ${productName}</p>
          <p><strong>Product ID:</strong> ${productId}</p>
          <p><strong>Current Stock:</strong> ${currentStock}</p>
          <p><strong>Threshold:</strong> ${threshold}</p>
          <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p style="color: #dc2626; font-weight: bold;">⚠️ Restock required immediately!</p>
      </div>
    `;

    const textContent = `Low Stock Alert!\nProduct: ${productName}\nProduct ID: ${productId}\nCurrent Stock: ${currentStock}\nThreshold: ${threshold}\nTime: ${new Date().toLocaleString()}`;

    // Send email notification
    if (adminNotificationSettings.emailNotifications && adminNotificationSettings.lowStockAlerts) {
      await sendEmailNotification(adminNotificationSettings.email, subject, htmlContent, textContent);
    }

    // Send SMS notification for critical low stock
    if (adminNotificationSettings.smsNotifications && adminNotificationSettings.lowStockAlerts && currentStock <= 5) {
      const smsMessage = `⚠️ CRITICAL: ${productName} stock at ${currentStock}!`;
      await sendSMSNotification(adminNotificationSettings.phone, smsMessage);
    }

    res.json({ success: true, message: 'Low stock notifications sent' });

  } catch (error) {
    console.error('Low stock notification failed:', error);
    res.status(500).json({ success: false, message: 'Failed to send notifications' });
  }
});

// Test notification
router.post('/test', async (req, res) => {
  try {
    const { type } = req.body; // 'email' or 'sms'

    if (type === 'email') {
      const subject = '🧪 Test Notification - E-commerce System';
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #7c3aed;">Test Notification</h2>
          <p>Your email notification system is working correctly!</p>
          <p>Sent at: ${new Date().toLocaleString()}</p>
        </div>
      `;
      await sendEmailNotification(adminNotificationSettings.email, subject, htmlContent, 'Test notification - your email system is working!');
    } else if (type === 'sms') {
      const smsMessage = '🧪 Test SMS - Your notification system is working!';
      await sendSMSNotification(adminNotificationSettings.phone, smsMessage);
    }

    res.json({ success: true, message: `Test ${type} notification sent` });

  } catch (error) {
    console.error('Test notification failed:', error);
    res.status(500).json({ success: false, message: 'Test notification failed' });
  }
});

module.exports = router;
const emailOtpTemplete = (otp) => {
  return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #f4f4f4;
            margin: 0;
            padding: 0;
        }
        .container {
            max-width: 600px;
            margin: 50px auto;
            background: #ffffff;
            padding: 20px;
            border-radius: 10px;
            box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
            text-align: center;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        .otp {
            font-size: 28px;
            font-weight: bold;
            color: #007bff;
            margin: 20px 0;
        }
        .footer {
            margin-top: 20px;
            font-size: 12px;
            color: #777;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Stream-engine</div>
        <h2>Email Verification</h2>
        <p>Use the OTP below to verify your email address:</p>
        <div class="otp">${otp}</div>
        <p>This OTP is valid for 1 minutes. Do not share it with anyone.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
        <div class="footer">&copy; 2025 stream-engine. All rights reserved.</div>
    </div>
</body>
</html>
    `;
};

export default emailOtpTemplete;

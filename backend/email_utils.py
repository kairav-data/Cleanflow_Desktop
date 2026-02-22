import smtplib
from email.message import EmailMessage
import os
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

def get_smtp_config():
    return {
        "host": os.getenv("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.getenv("SMTP_PORT", 587)),
        "user": os.getenv("SMTP_USER"),
        "password": os.getenv("SMTP_PASSWORD")
    }

from logger import setup_logger
logger = setup_logger(__name__)

def send_otp_email(to_email: str, otp: str):
    """Sends an OTP email to the user. Prints warning if SMTP is not configured."""
    config = get_smtp_config()
    logger.debug(f"Attempting to send OTP email to {to_email}")
    logger.debug(f"Using Host: {config['host']}:{config['port']}")
    logger.debug(f"SMTP User configured: {'YES' if config['user'] else 'NO'}, SMTP Password configured: {'YES' if config['password'] else 'NO'}")
    
    if not config['user'] or not config['password']:
        logger.warning(f"[MOCK EMAIL] Missing credentials. OTP for {to_email} is: {otp}")
        return
        
    try:
        import datetime
        from email.mime.multipart import MIMEMultipart
        from email.mime.text import MIMEText
        from email.mime.image import MIMEImage
        import base64
        try:
            from logo_b64 import LOGO_BASE64
        except ImportError:
            LOGO_BASE64 = "" # Fallback if missing
            
        msg = MIMEMultipart('related')
        msg['Subject'] = 'Your CleanFlow Verification Code'
        msg['From'] = f"CleanFlow <{config['user']}>"
        msg['To'] = to_email
        
        msg_alternative = MIMEMultipart('alternative')
        msg.attach(msg_alternative)
        
        # Plain text fallback
        plain_text = f"Your CleanFlow verification code is: {otp}\n\nThis code will expire in 10 minutes.\nIf you didn't request this, please ignore this email."
        msg_alternative.attach(MIMEText(plain_text, 'plain'))
        
        # HTML professional version
        html_content = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>CleanFlow Verification</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 0;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
                
                <!-- Header -->
                <div style="background-color: #0f172a; padding: 30px; text-align: center;">
                    <img src="cid:cleanflow_logo" alt="CleanFlow" style="height: 36px; width: auto;" />
                </div>
                
                <!-- Body -->
                <div style="padding: 40px 30px;">
                    <h2 style="color: #1e293b; font-size: 20px; font-weight: 600; margin-top: 0; margin-bottom: 20px;">Verify your identity</h2>
                    <p style="color: #475569; font-size: 16px; line-height: 1.6; margin-bottom: 30px; margin-top: 0;">
                        Thanks for using CleanFlow. To complete your login or registration, please use the verification code below. This code will expire in 10 minutes.
                    </p>
                    
                    <!-- OTP Box -->
                    <div style="background-color: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 30px;">
                        <span style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #0f172a;">{otp}</span>
                    </div>
                    
                    <p style="color: #64748b; font-size: 14px; line-height: 1.5; margin-bottom: 0;">
                        If you didn't request this code, you can safely ignore this email. Someone might have typed your email address by mistake.
                    </p>
                </div>
                
                <!-- Footer -->
                <div style="background-color: #f8fafc; padding: 24px 30px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="color: #94a3b8; font-size: 13px; margin: 0; line-height: 1.5;">
                        &copy; {datetime.datetime.now().year} CleanFlow. All rights reserved.<br>
                        This is an automated message, please do not reply.
                    </p>
                </div>
                
            </div>
        </body>
        </html>
        """
        
        msg_alternative.attach(MIMEText(html_content, 'html'))
        
        if LOGO_BASE64:
            logo_bytes = base64.b64decode(LOGO_BASE64)
            img = MIMEImage(logo_bytes, _subtype='png')
            img.add_header('Content-ID', '<cleanflow_logo>')
            img.add_header('Content-Disposition', 'inline')
            msg.attach(img)
        
        logger.debug("Connecting to SMTP server...")
        with smtplib.SMTP(config['host'], config['port']) as server:
            server.set_debuglevel(1) # Enable SMTP debug output
            logger.debug("Starting TLS...")
            server.starttls()
            logger.debug("Logging in...")
            server.login(config['user'], config['password'])
            logger.debug("Sending message...")
            server.send_message(msg)
            
        logger.info(f"✅ OTP Email sent successfully to {to_email}")
    except smtplib.SMTPAuthenticationError as e:
        logger.error(f"❌ [SMTP ERROR] Authentication failed. Check your App Password and Gmail settings: {e}")
    except smtplib.SMTPException as e:
        logger.error(f"❌ [SMTP ERROR] SMTP protocol error: {e}")
    except Exception as e:
        logger.error(f"❌ [SMTP ERROR] General failure sending OTP email to {to_email}: {e}")

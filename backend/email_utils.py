import os
import resend

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))
except ImportError:
    pass

from logger import setup_logger
logger = setup_logger(__name__)

# Initialize the Resend API Key
resend.api_key = os.getenv("RESEND_API_KEY")

def send_otp_email(to_email: str, otp: str):
    """Sends an OTP email to the user using the Resend API. Prints warning if API key is not configured."""
    logger.debug(f"Attempting to send OTP email to {to_email} via Resend")
    
    if not resend.api_key:
        logger.warning(f"[MOCK EMAIL] Missing RESEND_API_KEY. OTP for {to_email} is: {otp}")
        return
        
    try:
        import datetime
        from logo_b64 import LOGO_BASE64
        
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
        
        params = {
            "from": "CleanFlow <no-reply@onboarding.cleanflow.one>",
            "to": [to_email],
            "subject": "Your CleanFlow Verification Code",
            "html": html_content,
        }
        
        response = resend.Emails.send(params)
        logger.info(f"OTP email sent successfully to {to_email}. Resend Email ID: {response.get('id')}")
        
    except Exception as e:
        logger.error(f"[RESEND API ERROR] General failure sending OTP email to {to_email}: {e}")


def send_pipeline_email(to_email: str, subject: str, body: str, pipeline_name: str = "Pipeline") -> dict:
    """
    Sends a pipeline notification email via Resend from admin@cleanflow.one.
    Returns {"success": True} or {"success": False, "error": "..."}.
    """
    import datetime

    if not resend.api_key:
        logger.warning("[PIPELINE EMAIL] Missing RESEND_API_KEY - email not sent.")
        return {"success": False, "error": "RESEND_API_KEY not configured on server."}

    # Safely escape body for HTML and convert newlines to <br>
    body_html = (body
                 .replace("&", "&amp;")
                 .replace("<", "&lt;")
                 .replace(">", "&gt;")
                 .replace("\n", "<br>"))
    year = datetime.datetime.now().year

    html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f4f5; margin: 0; padding: 40px 0;">
  <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">

    <!-- Header bar -->
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px 32px;">
      <h1 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700; letter-spacing: -0.3px;">
        CleanFlow Pipeline Notification
      </h1>
      <p style="margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 13px;">{pipeline_name}</p>
    </div>

    <!-- Body -->
    <div style="padding: 36px 32px;">
      <h2 style="color: #1e293b; font-size: 18px; font-weight: 600; margin: 0 0 16px;">{subject}</h2>
      <div style="color: #475569; font-size: 15px; line-height: 1.7; background: #f8fafc; border-left: 4px solid #10b981; border-radius: 4px; padding: 16px 20px;">
        {body_html}
      </div>
    </div>

    <!-- Footer -->
    <div style="background: #f8fafc; padding: 20px 32px; border-top: 1px solid #e2e8f0; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">
        &copy; {year} CleanFlow &nbsp;|&nbsp; Sent from notification@onboarding.cleanflow.one &nbsp;|&nbsp; Do not reply
      </p>
    </div>
  </div>
</body>
</html>"""

    try:
        params = {
            "from": "CleanFlow <notification@onboarding.cleanflow.one>",
            "to": [to_email],
            "subject": subject,
            "html": html_content,
            "text": body,  # plain-text fallback
        }
        response = resend.Emails.send(params)
        logger.info(f"Pipeline email sent to {to_email}. Resend ID: {response.get('id')}")
        return {"success": True, "resend_id": response.get("id")}
    except Exception as e:
        logger.error(f"[PIPELINE EMAIL ERROR] Failed to send to {to_email}: {e}")
        return {"success": False, "error": str(e)}

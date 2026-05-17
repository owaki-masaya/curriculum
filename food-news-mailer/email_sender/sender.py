import smtplib
import os
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional
import logging

logger = logging.getLogger(__name__)


def send_email(
    to_addresses: list[str],
    subject: str,
    html_body: str,
    smtp_host: str = "smtp.gmail.com",
    smtp_port: int = 587,
    smtp_user: Optional[str] = None,
    smtp_password: Optional[str] = None,
) -> bool:
    """
    Send an HTML email to one or more recipients via SMTP with STARTTLS.

    Credentials and host/port can be provided as parameters or read from
    environment variables. Parameters take precedence over env vars.

    Environment variables:
        SMTP_HOST       SMTP server hostname
        SMTP_PORT       SMTP server port (integer)
        SMTP_USER       SMTP login username (also used as From address)
        SMTP_PASSWORD   SMTP login password / app password

    Parameters
    ----------
    to_addresses : list[str]
        One or more recipient email addresses.
    subject : str
        Email subject line.
    html_body : str
        Full HTML content of the email body.
    smtp_host : str
        SMTP server hostname. Defaults to "smtp.gmail.com".
        Overridden by SMTP_HOST env var if the parameter is still the default.
    smtp_port : int
        SMTP server port. Defaults to 587 (STARTTLS).
        Overridden by SMTP_PORT env var if the parameter is still the default.
    smtp_user : str, optional
        SMTP login user. Falls back to SMTP_USER env var.
    smtp_password : str, optional
        SMTP login password. Falls back to SMTP_PASSWORD env var.

    Returns
    -------
    bool
        True if the message was accepted by the server, False otherwise.
    """
    # Resolve credentials from env if not supplied
    resolved_host = smtp_host if smtp_host != "smtp.gmail.com" else os.environ.get("SMTP_HOST", smtp_host)
    resolved_port_str = os.environ.get("SMTP_PORT", "")
    resolved_port = smtp_port
    if resolved_port_str:
        try:
            resolved_port = int(resolved_port_str)
        except ValueError:
            logger.warning("SMTP_PORT env var '%s' is not a valid integer; using default %d", resolved_port_str, smtp_port)

    resolved_user = smtp_user or os.environ.get("SMTP_USER")
    resolved_password = smtp_password or os.environ.get("SMTP_PASSWORD")

    if not resolved_user:
        logger.error("SMTP username not provided. Set smtp_user parameter or SMTP_USER env var.")
        return False

    if not resolved_password:
        logger.error("SMTP password not provided. Set smtp_password parameter or SMTP_PASSWORD env var.")
        return False

    if not to_addresses:
        logger.error("No recipient addresses provided.")
        return False

    # Build MIME message
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = resolved_user
    msg["To"] = ", ".join(to_addresses)

    # Attach a plain-text fallback for clients that don't render HTML
    plain_fallback = (
        "このメールはHTMLメールです。対応しているメールクライアントでご覧ください。\n"
        "This email requires an HTML-capable email client."
    )
    msg.attach(MIMEText(plain_fallback, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))

    try:
        logger.info(
            "Connecting to SMTP server %s:%d as %s",
            resolved_host, resolved_port, resolved_user,
        )
        with smtplib.SMTP(resolved_host, resolved_port, timeout=30) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(resolved_user, resolved_password)
            refused = server.sendmail(resolved_user, to_addresses, msg.as_string())

        if refused:
            logger.warning(
                "Message sent but %d address(es) were refused: %s",
                len(refused), refused,
            )
        else:
            logger.info(
                "Email sent successfully to %d recipient(s): %s",
                len(to_addresses), ", ".join(to_addresses),
            )
        return True

    except smtplib.SMTPAuthenticationError as exc:
        logger.error("SMTP authentication failed for user '%s': %s", resolved_user, exc)
    except smtplib.SMTPConnectError as exc:
        logger.error("Failed to connect to SMTP server %s:%d: %s", resolved_host, resolved_port, exc)
    except smtplib.SMTPRecipientsRefused as exc:
        logger.error("All recipients were refused by the server: %s", exc)
    except smtplib.SMTPException as exc:
        logger.error("SMTP error while sending email: %s", exc)
    except OSError as exc:
        logger.error("Network error while connecting to SMTP server: %s", exc)

    return False

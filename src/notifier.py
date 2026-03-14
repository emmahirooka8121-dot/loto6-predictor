"""通知モジュール（LINE/Slack/メール）"""

import logging
import os
import smtplib
from email.mime.text import MIMEText

import requests
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv()


def send_notification(message: str) -> bool:
    """設定されている通知チャネルにメッセージを送信"""
    sent = False

    if os.getenv("LINE_NOTIFY_TOKEN"):
        sent = _send_line(message) or sent

    if os.getenv("SLACK_WEBHOOK_URL"):
        sent = _send_slack(message) or sent

    if os.getenv("SMTP_HOST") and os.getenv("MAIL_TO"):
        sent = _send_email(message) or sent

    if not sent:
        logger.info("通知設定がないため、コンソール出力のみです")
        print(message)

    return sent


def _send_line(message: str) -> bool:
    """LINE Notifyで通知"""
    token = os.getenv("LINE_NOTIFY_TOKEN")
    if not token:
        return False

    try:
        response = requests.post(
            "https://notify-api.line.me/api/notify",
            headers={"Authorization": f"Bearer {token}"},
            data={"message": message},
            timeout=10,
        )
        response.raise_for_status()
        logger.info("LINE通知を送信しました")
        return True
    except Exception as e:
        logger.error("LINE通知の送信に失敗: %s", e)
        return False


def _send_slack(message: str) -> bool:
    """Slack Webhookで通知"""
    webhook_url = os.getenv("SLACK_WEBHOOK_URL")
    if not webhook_url:
        return False

    try:
        response = requests.post(
            webhook_url,
            json={"text": message},
            timeout=10,
        )
        response.raise_for_status()
        logger.info("Slack通知を送信しました")
        return True
    except Exception as e:
        logger.error("Slack通知の送信に失敗: %s", e)
        return False


def _send_email(message: str) -> bool:
    """メールで通知"""
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    mail_to = os.getenv("MAIL_TO")

    if not all([host, user, password, mail_to]):
        return False

    try:
        msg = MIMEText(message, "plain", "utf-8")
        msg["Subject"] = "🎯 ロト6予想通知"
        msg["From"] = user
        msg["To"] = mail_to

        with smtplib.SMTP(host, port) as server:
            server.starttls()
            server.login(user, password)
            server.send_message(msg)

        logger.info("メール通知を送信しました")
        return True
    except Exception as e:
        logger.error("メール通知の送信に失敗: %s", e)
        return False

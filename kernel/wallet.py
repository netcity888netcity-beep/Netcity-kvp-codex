"""
KVP Kernel: Sacred Wallet v0.3
Object-oriented wallet with logging, validation, and CSV export.
"""

import hashlib
import json
import os
import csv
import logging
from datetime import datetime
from typing import Dict, Optional, List, Tuple

logging.basicConfig(level=logging.INFO, format='%(asctime)s [KVP] %(message)s')
logger = logging.getLogger(__name__)

WALLETS_FILE = "wallets.json"
LEDGER_FILE = "ledger.json"
LOG_FILE = "transactions.log"


class Wallet:
    """Священный кошелёк KVP."""

    def __init__(self):
        self.wallets: Dict[str, str] = {}
        self.ledger: Dict[str, float] = {}
        self._load_data()

    def _load_data(self):
        if os.path.exists(WALLETS_FILE):
            with open(WALLETS_FILE, 'r') as f:
                self.wallets = json.load(f)
        if os.path.exists(LEDGER_FILE):
            with open(LEDGER_FILE, 'r') as f:
                self.ledger = json.load(f)
        logger.info(f"Wallet loaded: {len(self.wallets)} addresses")

    def _save_data(self):
        with open(WALLETS_FILE, 'w') as f:
            json.dump(self.wallets, f, indent=2)
        with open(LEDGER_FILE, 'w') as f:
            json.dump(self.ledger, f, indent=2)

    def _log_transaction(self, tx_type: str, sender: str, receiver: str, amount: float, status: str):
        with open(LOG_FILE, 'a', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([datetime.now().isoformat(), tx_type, sender, receiver, amount, status])

    def _generate_address(self, public_key_bytes: bytes) -> str:
        sha256_hash = hashlib.sha256(public_key_bytes).digest()
        ripemd160 = hashlib.new('ripemd160')
        ripemd160.update(sha256_hash)
        return ripemd160.hexdigest()

    def is_valid_address(self, address: str) -> bool:
        return address in self.ledger

    def create_wallet(self) -> str:
        import ecdsa
        private_key = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)
        public_key = private_key.get_verifying_key()
        address = self._generate_address(public_key.to_string())

        self.wallets[address] = private_key.to_string().hex()
        self.ledger[address] = 0.0
        self._save_data()

        logger.info(f"New wallet created: {address}")
        return address

    def get_balance(self, address: str) -> float:
        if not self.is_valid_address(address):
            raise ValueError(f"Invalid address: {address}")
        return self.ledger[address]

    def transfer(self, sender_private_key_hex: str, receiver_address: str, amount: float) -> bool:
        import ecdsa

        if amount <= 0:
            raise ValueError("Amount must be positive")

        if not self.is_valid_address(receiver_address):
            raise ValueError(f"Invalid receiver address: {receiver_address}")

        sender_private_key = ecdsa.SigningKey.from_string(
            bytes.fromhex(sender_private_key_hex),
            curve=ecdsa.SECP256k1
        )
        sender_address = self._generate_address(
            sender_private_key.get_verifying_key().to_string()
        )

        if not self.is_valid_address(sender_address):
            raise ValueError(f"Invalid sender address: {sender_address}")

        if self.ledger[sender_address] < amount:
            raise ValueError("Insufficient balance")

        self.ledger[sender_address] -= amount
        self.ledger[receiver_address] += amount
        self._save_data()

        self._log_transaction("TRANSFER", sender_address, receiver_address, amount, "SUCCESS")
        logger.info(f"Transfer: {amount} from {sender_address[:12]}... to {receiver_address[:12]}...")
        return True

    def list_addresses(self) -> List[str]:
        return list(self.wallets.keys())

    def total_supply(self) -> float:
        return sum(self.ledger.values())

    def export_csv(self, filename: str = "ledger_export.csv"):
        with open(filename, 'w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["Address", "Balance"])
            for addr, balance in self.ledger.items():
                writer.writerow([addr, balance])
        logger.info(f"Ledger exported to {filename}")


kvp_wallet = Wallet()

def create_wallet() -> str:
    return kvp_wallet.create_wallet()

def get_balance(address: str) -> float:
    return kvp_wallet.get_balance(address)

def transfer(sender_private_key_hex: str, receiver_address: str, amount: float) -> bool:
    return kvp_wallet.transfer(sender_private_key_hex, receiver_address, amount)

print(f"KVP Sacred Wallet v0.3 loaded.")
print(f"Active addresses: {len(kvp_wallet.list_addresses())}")
print(f"Total supply: {kvp_wallet.total_supply()}")

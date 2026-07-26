"""
KVP Kernel: Sacred Wallet v0.1
First module of the KVP protocol.
Handles wallet creation, balance checks, and transfers.
"""

import hashlib
import json
from typing import Dict, Optional

# In-memory ledger for storing balances
ledger: Dict[str, float] = {}

# In-memory storage for wallets (address -> private_key)
wallets: Dict[str, str] = {}

def create_wallet() -> str:
    """
    Generates a new wallet.
    Returns the wallet address.
    """
    import ecdsa

    # Generate private key
    private_key = ecdsa.SigningKey.generate(curve=ecdsa.SECP256k1)
    public_key = private_key.get_verifying_key()

    # Generate address from public key
    public_key_bytes = public_key.to_string()
    sha256_hash = hashlib.sha256(public_key_bytes).digest()
    ripemd160 = hashlib.new('ripemd160')
    ripemd160.update(sha256_hash)
    address = ripemd160.hexdigest()

    # Store wallet
    private_key_hex = private_key.to_string().hex()
    wallets[address] = private_key_hex
    ledger[address] = 0.0

    return address

def get_balance(address: str) -> float:
    """
    Returns the current balance of the given address.
    """
    return ledger.get(address, 0.0)

def transfer(sender_private_key_hex: str, receiver_address: str, amount: float) -> bool:
    """
    Transfers funds from sender to receiver.
    Requires sender's private key in hex format.
    Returns True if successful, raises ValueError on failure.
    """
    import ecdsa

    # Reconstruct sender's keys from private key
    sender_private_key = ecdsa.SigningKey.from_string(
        bytes.fromhex(sender_private_key_hex),
        curve=ecdsa.SECP256k1
    )
    sender_public_key = sender_private_key.get_verifying_key()

    # Derive sender's address
    public_key_bytes = sender_public_key.to_string()
    sha256_hash = hashlib.sha256(public_key_bytes).digest()
    ripemd160 = hashlib.new('ripemd160')
    ripemd160.update(sha256_hash)
    sender_address = ripemd160.hexdigest()

    # Check balance
    if ledger.get(sender_address, 0.0) < amount:
        raise ValueError("Insufficient balance")

    # Check if receiver exists
    if receiver_address not in ledger:
        raise ValueError("Receiver address not found")

    # Execute transfer
    ledger[sender_address] -= amount
    ledger[receiver_address] += amount

    return True

# Signal
print("KVP Sacred Wallet v0.1 loaded. Ready to build the bridge.")
print(f"Active addresses: {len(ledger)}")

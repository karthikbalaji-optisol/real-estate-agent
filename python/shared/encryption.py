"""
AES-256-CBC encryption/decryption matching the NestJS encryption format.

Ciphertext format: ``<iv_hex>:<encrypted_hex>``
"""

from __future__ import annotations

import os
from Crypto.Cipher import AES
from Crypto.Util.Padding import pad


def encrypt(plaintext: str, key_hex: str) -> str:
    key = bytes.fromhex(key_hex)
    iv = os.urandom(16)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    padded = pad(plaintext.encode('utf-8'), AES.block_size)
    encrypted = cipher.encrypt(padded)
    return f'{iv.hex()}:{encrypted.hex()}'


def decrypt(ciphertext: str, key_hex: str) -> str:
    iv_hex, encrypted_hex = ciphertext.split(':')
    key = bytes.fromhex(key_hex)
    iv = bytes.fromhex(iv_hex)
    cipher = AES.new(key, AES.MODE_CBC, iv)
    padded = cipher.decrypt(bytes.fromhex(encrypted_hex))
    pad_len = padded[-1]
    return padded[:-pad_len].decode('utf-8')

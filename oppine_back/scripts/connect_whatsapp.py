#!/usr/bin/env python3
"""
Script para conectar uma instância WhatsApp via QR Code no Evolution API.
Salva a imagem do QR code em um arquivo.
"""

import httpx
import base64
import sys
import os
from pathlib import Path

# Carregar configurações do .env
from dotenv import load_dotenv
load_dotenv()

EVOLUTION_API_URL = os.getenv("EVOLUTION_API_URL", "http://localhost:8080")
EVOLUTION_API_KEY = os.getenv("EVOLUTION_API_KEY", "")

HEADERS = {
    "apikey": EVOLUTION_API_KEY,
    "Content-Type": "application/json"
}


def list_instances():
    """Lista todas as instâncias existentes."""
    response = httpx.get(
        f"{EVOLUTION_API_URL}/instance/fetchInstances",
        headers=HEADERS,
        timeout=30.0
    )

    if response.status_code == 200:
        instances = response.json()
        print("\n=== Instâncias existentes ===")
        if not instances:
            print("Nenhuma instância encontrada.")
        for inst in instances:
            name = inst.get("instance", {}).get("instanceName", inst.get("instanceName", "N/A"))
            state = inst.get("instance", {}).get("state", inst.get("state", "N/A"))
            print(f"  - {name}: {state}")
        return instances
    else:
        print(f"Erro ao listar instâncias: {response.status_code}")
        print(response.text)
        return []


def create_instance(instance_name: str):
    """Cria uma nova instância."""
    response = httpx.post(
        f"{EVOLUTION_API_URL}/instance/create",
        headers=HEADERS,
        json={
            "instanceName": instance_name,
            "qrcode": True,
            "integration": "WHATSAPP-BAILEYS"
        },
        timeout=30.0
    )

    if response.status_code in [200, 201]:
        data = response.json()
        print(f"\nInstância '{instance_name}' criada com sucesso!")
        return data
    else:
        print(f"Erro ao criar instância: {response.status_code}")
        print(response.text)
        return None


def get_qrcode(instance_name: str) -> dict:
    """Obtém o QR code para conexão."""
    response = httpx.get(
        f"{EVOLUTION_API_URL}/instance/connect/{instance_name}",
        headers=HEADERS,
        timeout=30.0
    )

    if response.status_code == 200:
        return response.json()
    else:
        print(f"Erro ao obter QR code: {response.status_code}")
        print(response.text)
        return {}


def save_qrcode_image(qr_data: dict, output_path: str) -> bool:
    """Salva a imagem do QR code em um arquivo."""
    # O Evolution API retorna o QR code em base64 no campo 'base64' ou 'qrcode'
    base64_data = qr_data.get("base64") or qr_data.get("qrcode", {}).get("base64")

    if not base64_data:
        # Tenta pegar do campo code que pode ser data URI
        code = qr_data.get("code") or qr_data.get("qrcode", {}).get("code")
        if code and code.startswith("data:image"):
            # Extrai base64 do data URI
            base64_data = code.split(",")[1] if "," in code else None

    if not base64_data:
        print("QR code base64 não encontrado na resposta.")
        print(f"Resposta recebida: {qr_data}")
        return False

    try:
        # Decodifica e salva a imagem
        image_data = base64.b64decode(base64_data)

        with open(output_path, "wb") as f:
            f.write(image_data)

        print(f"\n✅ QR code salvo em: {output_path}")
        return True
    except Exception as e:
        print(f"Erro ao salvar imagem: {e}")
        return False


def check_connection_state(instance_name: str) -> str:
    """Verifica o estado da conexão."""
    response = httpx.get(
        f"{EVOLUTION_API_URL}/instance/connectionState/{instance_name}",
        headers=HEADERS,
        timeout=30.0
    )

    if response.status_code == 200:
        data = response.json()
        state = data.get("instance", {}).get("state", "unknown")
        return state
    return "unknown"


def main():
    if not EVOLUTION_API_KEY:
        print("❌ EVOLUTION_API_KEY não configurada no .env")
        sys.exit(1)

    print(f"Evolution API URL: {EVOLUTION_API_URL}")
    print(f"API Key: {EVOLUTION_API_KEY[:8]}...")

    # Lista instâncias existentes
    instances = list_instances()

    # Pede nome da instância
    if len(sys.argv) > 1:
        instance_name = sys.argv[1]
    else:
        instance_name = input("\nDigite o nome da instância (ou Enter para 'oppine-dev'): ").strip()
        if not instance_name:
            instance_name = "oppine-dev"

    # Verifica se a instância existe
    existing = [i for i in instances if i.get("instance", {}).get("instanceName") == instance_name or i.get("instanceName") == instance_name]

    if not existing:
        print(f"\nInstância '{instance_name}' não existe. Criando...")
        result = create_instance(instance_name)
        if not result:
            sys.exit(1)

    # Verifica estado da conexão
    state = check_connection_state(instance_name)
    print(f"\nEstado atual da conexão: {state}")

    if state == "open":
        print("✅ Instância já está conectada!")
        sys.exit(0)

    # Obtém QR code
    print(f"\nObtendo QR code para '{instance_name}'...")
    qr_data = get_qrcode(instance_name)

    if not qr_data:
        sys.exit(1)

    # Define caminho de saída
    output_dir = Path(__file__).parent.parent / "media"
    output_dir.mkdir(exist_ok=True)
    output_path = output_dir / f"qrcode_{instance_name}.png"

    # Salva a imagem
    if save_qrcode_image(qr_data, str(output_path)):
        print(f"\n📱 Escaneie o QR code com seu WhatsApp!")
        print(f"   Arquivo: {output_path}")

        # Mostra também o código pix/string se disponível
        pairingCode = qr_data.get("pairingCode")
        if pairingCode:
            print(f"\n   Código de pareamento: {pairingCode}")
    else:
        # Se não conseguiu salvar a imagem, mostra o código como texto
        code = qr_data.get("code")
        if code:
            print(f"\nQR Code (texto):\n{code}")


if __name__ == "__main__":
    main()

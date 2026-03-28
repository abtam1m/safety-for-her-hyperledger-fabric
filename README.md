
# SafeReport — Blockchain-Based Anonymous Reporting System

> A Hyperledger Fabric 2.5.15 powered platform for safe, anonymous reporting of Technology-Facilitated Gender-Based Violence (TFGBV). Built with 3-organization blockchain network, Fabric CA identity management, IPFS file storage via Pinata, and a React frontend.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [WSL2 Setup](#wsl2-setup)
5. [Docker Setup](#docker-setup)
6. [Node.js Setup](#nodejs-setup)
7. [Hyperledger Fabric Setup](#hyperledger-fabric-setup)
8. [Network Setup](#network-setup)
9. [Fabric CA Setup](#fabric-ca-setup)
10. [Backend Setup](#backend-setup)
11. [Frontend Setup](#frontend-setup)
12. [Running the System](#running-the-system)
13. [API Reference](#api-reference)
14. [User Roles](#user-roles)
15. [Troubleshooting](#troubleshooting)

---

## Project Overview

SafeReport solves the problem of unsafe, unaccountable reporting of TFGBV by providing:

- **Anonymous reporting** — victims never store their real identity
- **Immutable evidence** — SHA-256 hashes stored on blockchain, files on IPFS
- **Access control** — only authorized orgs can view/update cases
- **Full audit trail** — every action permanently recorded on-chain
- **Referral system** — NGOs can refer cases to legal authorities

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    React Frontend                    │
│                  (localhost:3000)                    │
└─────────────────────┬───────────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────────┐
│               Express.js API Backend                 │
│                  (localhost:3001)                    │
│  JWT Auth │ Fabric CA Client │ Pinata IPFS Client   │
└──────┬────────────────┬───────────────────┬─────────┘
       │                │                   │
┌──────▼──────┐  ┌──────▼──────┐    ┌──────▼──────┐
│  Fabric CA  │  │  Hyperledger │    │   Pinata    │
│  (4 CAs)    │  │  Fabric Net  │    │    IPFS     │
│  Org1,2,3   │  │  safechannel │    │   Storage   │
│  + Orderer  │  │  3 Peers     │    └─────────────┘
└─────────────┘  │  CouchDB     │
                 │  Orderer     │
                 └─────────────┘
```

### Organizations

| Org | Role | Port |
|-----|------|------|
| Org1MSP | Victim (anonymous reporter) | 7051 |
| Org2MSP | NGO Case Handler | 9051 |
| Org3MSP | Legal Authority | 11051 |

---

## Prerequisites

### System Requirements

- **OS**: Windows 10/11 with WSL2 (Ubuntu 22.04)
- **RAM**: Minimum 8GB (16GB recommended)
- **Storage**: 20GB free space
- **CPU**: 4+ cores recommended

### Accounts Required

- [Pinata](https://pinata.cloud) account (free tier works) — for IPFS file storage
- Git installed

---

## WSL2 Setup

### 1. Enable WSL2 on Windows

Open **PowerShell as Administrator**:

```powershell
# Enable WSL
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart

# Enable Virtual Machine Platform
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart

# Set WSL2 as default
wsl --set-default-version 2

# Install Ubuntu 22.04
wsl --install -d Ubuntu-24.04
```

Restart your PC, then open Ubuntu from Start Menu and set up your username/password.

### 2. Fix /etc/hosts (Prevent Reset on Restart)

```bash
sudo nano /etc/wsl.conf
```

Add:

```ini
[network]
generateHosts = false
```

### 3. Add Fabric Hostnames

```bash
echo "127.0.0.1  orderer.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  peer0.org1.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  peer0.org2.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  peer0.org3.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.org1.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.org2.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.org3.tfgbv.com" | sudo tee -a /etc/hosts
```

---

## Docker Setup

### 1. Install Docker Desktop for Windows

Download from [docker.com](https://www.docker.com/products/docker-desktop/)

### 2. Enable WSL2 Integration

Open Docker Desktop → Settings → Resources → WSL Integration → Enable for Ubuntu-22.04

### 3. Verify

```bash
docker --version
docker compose version
```

---

## Install Node.js on Ubuntu (In this project we used v24.14.0) 


---

## Hyperledger Fabric Setup

```bash
# Create working directory
mkdir -p ~/fabric-dev
cd ~/fabric-dev

# Download Fabric install script
curl -sSLO https://raw.githubusercontent.com/hyperledger/fabric/main/scripts/install-fabric.sh
chmod +x install-fabric.sh

# Install Fabric 2.5.15 (binaries + docker images + samples)
./install-fabric.sh --fabric-version 2.5.15 --ca-version 1.5.15 docker binary samples

# Add binaries to PATH (add to ~/.bashrc for persistence)
echo 'export PATH=$PATH:~/fabric-dev/fabric-samples/bin' >> ~/.bashrc
echo 'export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config' >> ~/.bashrc
source ~/.bashrc

# Verify
peer version      # should show 2.5.15
fabric-ca-client version  # should show 1.5.15
```

---

## Network Setup

### 1. Clone This Repository

```bash
cd ~/fabric-dev
git clone https://github.com/YOUR_USERNAME/safety-for-her-hyperledger-fabric.git
```

### 2. Directory Structure After Setup

```
~/fabric-dev/
├── fabric-samples/          ← Fabric tools (binaries)
├── tfgbv-network/           ← Network configs (from this repo)
├── tfgbv-chaincode/         ← Smart contracts (from this repo)
├── tfgbv-app/               ← Backend API (from this repo)
└── tfgbv-frontend/          ← React frontend (from this repo)
```

### 3. Copy Network Files

```bash
cp -r safereport/tfgbv-network ~/fabric-dev/
cp -r safereport/tfgbv-chaincode ~/fabric-dev/
cp -r safereport/tfgbv-app ~/fabric-dev/
cp -r safereport/tfgbv-frontend ~/fabric-dev/
```

---

## Fabric CA Setup

This is the most important step. Run these in order:

### 1. Create CA Config Files

```bash
cd ~/fabric-dev/tfgbv-network
mkdir -p fabric-ca/{orderer,org1,org2,org3}
```

Create `fabric-ca/org1/fabric-ca-server-config.yaml`:

```yaml
port: 8054
tls:
  enabled: true
ca:
  name: ca-org1
csr:
  cn: ca-org1
  hosts:
    - ca.org1.tfgbv.com
    - localhost
    - 127.0.0.1
  names:
    - C: US
      ST: "North Carolina"
      L:
      O: tfgbv
      OU:
registry:
  maxenrollments: -1
  identities:
    - name: admin
      pass: adminpw
      type: client
      affiliation: ""
      attrs:
        hf.Registrar.Roles: "*"
        hf.Registrar.DelegateRoles: "*"
        hf.Revoker: true
        hf.IntermediateCA: true
        hf.GenCRL: true
        hf.Registrar.Attributes: "*"
        hf.AffiliationMgr: true
signing:
  default:
    usage:
      - digital signature
    expiry: 8760h
  profiles:
    ca:
      usage:
        - cert sign
        - crl sign
      expiry: 43800h
      caconstraint:
        isca: true
        maxpathlen: 0
```

Repeat for `org2` (port 9054), `org3` (port 10054), and `orderer` (port 7054) — changing the port, CA name, and hostname accordingly.

### 2. Generate Crypto Material

```bash
cd ~/fabric-dev/tfgbv-network
export FABRIC_CFG_PATH=$PWD

# Generate certs with cryptogen
cryptogen generate \
  --config=./crypto-config.yaml \
  --output=./organizations

# Generate genesis block
configtxgen \
  -profile TFGBVGenesis \
  -channelID safechannel \
  -outputBlock ./channel-artifacts/genesis.block
```

### 3. Start CAs First

```bash
docker compose up -d ca.tfgbv.com ca.org1.tfgbv.com ca.org2.tfgbv.com ca.org3.tfgbv.com
sleep 10
```

### 4. Enroll All Identities

```bash
./scripts/enrollIdentities.sh
```

This script:
- Enrolls admin for each CA
- Registers and enrolls peers, users, orderer
- Re-enrolls TLS certs (ensures cert/key match)
- Registers seed users (handler, authority, victim)

### 5. Add config.yaml to MSPs

```bash
for ORG in org1 org2 org3; do
cat > ~/fabric-dev/tfgbv-network/organizations/peerOrganizations/${ORG}.tfgbv.com/msp/config.yaml << 'EOF'
NodeOUs:
  Enable: true
  ClientOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: client
  PeerOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: peer
  AdminOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: admin
  OrdererOUIdentifier:
    Certificate: cacerts/ca-cert.pem
    OrganizationalUnitIdentifier: orderer
EOF
cp ~/fabric-dev/tfgbv-network/organizations/peerOrganizations/${ORG}.tfgbv.com/msp/config.yaml \
   ~/fabric-dev/tfgbv-network/organizations/peerOrganizations/${ORG}.tfgbv.com/peers/peer0.${ORG}.tfgbv.com/msp/config.yaml
cp ~/fabric-dev/tfgbv-network/organizations/peerOrganizations/${ORG}.tfgbv.com/msp/config.yaml \
   ~/fabric-dev/tfgbv-network/organizations/peerOrganizations/${ORG}.tfgbv.com/users/Admin@${ORG}.tfgbv.com/msp/config.yaml
done
```

### 6. Start Full Network

```bash
cd ~/fabric-dev/tfgbv-network
docker compose up -d
sleep 8

# Create channel and deploy chaincode
./scripts/createChannel.sh
./scripts/deployChaincode.sh
```

Expected output:
```
Chaincode 'tfgbv' deployed successfully on 'safechannel'!
```

---

## Backend Setup

### 1. Install Dependencies

```bash
cd ~/fabric-dev/tfgbv-app
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
nano .env
```

Open `.env` and replace all placeholder values:
   - `YOUR_USERNAME` → your Linux username (e.g. `tamim`)
   - `your_channel_name` → your Fabric channel name
   - `your_chaincode_name` → your chaincode name
   - `your_pinata_jwt_token_here` → your Pinata JWT from [pinata.cloud](https://pinata.cloud)
   - `your_pinata_gateway_url_here` → your Pinata dedicated gateway URL
   -`If you are using **cryptogen** instead of **CA**, comment out the CA cert block and uncomment the cryptogen block in `.env`.


Generate JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Start Backend

```bash
npm run dev
```

You should see:
```
All admins enrolled 
Seed user handler enrolled 
Seed user authority enrolled 
TFGBV API running on http://localhost:3001
```

---

## Frontend Setup

### 1. Install Dependencies

```bash
cd ~/fabric-dev/tfgbv-frontend
npm install
```

### 2. Configure Environment

```bash
echo "REACT_APP_API_URL=http://localhost:3001/api" > .env
```

### 3. Start Frontend

```bash
npm start
```

Opens at `http://localhost:3000`

---

## Running the System

### Daily Startup (After Initial Setup)

**Terminal 1 — Network (unless all the volumes are removed) :**
```bash
cd ~/fabric-dev/tfgbv-network
docker compose up -d
```

**Terminal 2 — Backend:**
```bash
cd ~/fabric-dev/tfgbv-app
npm run dev
```

**Terminal 3 — Frontend:**
```bash
cd ~/fabric-dev/tfgbv-frontend
npm start
```

### Full Fresh Start (Wipes All Data)

```bash
~/fabric-dev/start.sh
```

---

## API Reference

### Auth

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | None | Victim self-registration |
| POST | `/api/auth/login` | None | Login for all roles |
| POST | `/api/auth/logout` | JWT | Logout |
| GET | `/api/auth/me` | JWT | Get current user |
| POST | `/api/auth/revoke/:username` | JWT (Org2/3) | Revoke user identity |

### Reports

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/reports` | None | Submit anonymous report |
| GET | `/api/reports/status/:id?victimToken=` | None | Check case status |
| GET | `/api/reports` | JWT (Org2/3) | Get all reports |
| GET | `/api/reports/:id` | JWT (Org2/3) | Get single report |
| PATCH | `/api/reports/:id/status` | JWT (Org2/3) | Update status |
| GET | `/api/reports/:id/audit` | JWT (Org2/3) | Full audit trail |

### Evidence

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/evidence` | JWT | Register evidence hash |
| POST | `/api/evidence/verify` | None | Verify file integrity |
| GET | `/api/evidence/report/:id` | JWT (Org2/3) | Get evidence for report |
| PATCH | `/api/evidence/:id/verify` | JWT (Org3) | Mark evidence verified |

### Referrals

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/referrals` | JWT (Org2) | Create referral |
| PATCH | `/api/referrals/:id/respond` | JWT (Org3) | Accept/reject referral |

---

## User Roles

### Default Accounts

| Username | Password | Role | Org |
|----------|----------|------|-----|
| handler | ngo1234 | NGO Case Handler | Org2MSP |
| authority | legal1234 | Legal Authority | Org3MSP |
| victim | safe1234 | Victim (demo) | Org1MSP |

> Victims can self-register at `/api/auth/register`

### Permissions

| Feature | Victim (Org1) | Handler (Org2) | Authority (Org3) |
|---------|--------------|----------------|-----------------|
| Submit report |  |  |  |
| Check own case status |  | — | — |
| View all reports | ❌ |  |  |
| Update report status | ❌ |  |  |
| Register evidence |  |  |  |
| Verify evidence | ❌ | ❌ |  |
| Create referral | ❌ |  | ❌ |
| Respond to referral | ❌ | ❌ |  |
| Revoke user | ❌ |  |  |

---

## Troubleshooting

### Peers not starting
```bash
# Check logs
docker logs peer0.org1.tfgbv.com --tail 20

# If TLS cert/key mismatch — re-enroll TLS certs
cd ~/fabric-dev/tfgbv-network
./scripts/enrollIdentities.sh

# Restart peers
docker compose restart peer0.org1.tfgbv.com peer0.org2.tfgbv.com peer0.org3.tfgbv.com
```

### Orderer losing channel data
```bash
cd ~/fabric-dev/tfgbv-network
docker compose down
docker volume rm tfgbv-network_orderer.tfgbv.com \
  tfgbv-network_peer0.org1.tfgbv.com \
  tfgbv-network_peer0.org2.tfgbv.com \
  tfgbv-network_peer0.org3.tfgbv.com \
  tfgbv-network_couchdb0 tfgbv-network_couchdb1 tfgbv-network_couchdb2

docker compose up -d
sleep 8
./scripts/createChannel.sh
./scripts/deployChaincode.sh
```

### Authentication failure on CA
```bash
# Clear wallet and re-enroll
rm -rf ~/fabric-dev/tfgbv-app/wallet/*
npm run dev
```

### Hostnames not resolving after WSL restart
```bash
echo "127.0.0.1  orderer.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  peer0.org1.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  peer0.org2.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  peer0.org3.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.org1.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.org2.tfgbv.com" | sudo tee -a /etc/hosts
echo "127.0.0.1  ca.org3.tfgbv.com" | sudo tee -a /etc/hosts
```

### SignaturePolicyEnvelope error
This is caused by `setStateValidationParameter` being called with JSON instead of protobuf. Make sure ALL calls to `setStateValidationParameter` are removed/commented out from chaincode, then do a full reset and redeploy.

### VSCode not showing updated files
Always open VSCode from WSL terminal:
```bash
cd ~/fabric-dev/your-project
code .
```
Bottom-left of VSCode must show `>< WSL: Ubuntu`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Blockchain | Hyperledger Fabric 2.5.15 |
| Smart Contracts | Node.js (fabric-contract-api) |
| Identity | Fabric CA 1.5.15 |
| State DB | CouchDB 3.4.2 |
| File Storage | IPFS via Pinata |
| Backend | Node.js + Express |
| Authentication | JWT + bcrypt |
| Frontend | React 18 |
| Containerization | Docker + Docker Compose |

---

## License

MIT License — see LICENSE file for details.

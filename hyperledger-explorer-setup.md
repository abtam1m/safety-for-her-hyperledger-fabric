# Hyperledger Explorer Setup Guide

A step-by-step guide to deploy Hyperledger Explorer against any running Fabric network using Docker Compose.

---

## Prerequisites

- Docker & Docker Compose installed
- A running Hyperledger Fabric network
- Access to the network's crypto material (MSP folders)

---

## Step 1 - Identify Your Docker Network

List all Docker networks to find the one your Fabric peers are using:

```bash
docker network ls
```

Sample output:

```
NETWORK ID     NAME              DRIVER    SCOPE
a1b2c3d4e5f6   tfgbv-network     bridge    local
...
```

Once you identify the correct network name (e.g., `tfgbv-network`), update the `networks` section in your `docker-compose.yml`( replace all the `tfgbv-network` with your network's name):

```yaml
networks:
  tfgbv-network:
    external:
      name: tfgbv-network   # ← Replace with your actual network name
```

---

## Step 2 - Identify the Private Key

Fabric generates a unique hash for the admin private key. You need to locate the exact filename of the `_sk` file inside the MSP keystore directory(If you have multiple `_sk` file, choose the latest one) .

**Typical path pattern: (In this project)**

```
tfgbv-network/
  organizations/
    peerOrganizations/
      <org-domain>/
        users/
          Admin@<org-domain>/
            msp/
              keystore/
                <hash>_sk          ← This is the file you need
```

**Find it with:**

```bash
# Replace the path with your actual crypto-config location
ls crypto-config/peerOrganizations/<org-domain>/users/Admin@<org-domain>/msp/keystore/
```

**Copy the exact filename** (including the full hash) into your `test-network.json`:

```json
"organizations": {
		"Org1MSP": {
			"mspid": "Org1MSP",
			"adminPrivateKey": {
				"path": "/tmp/crypto/peerOrganizations/org1.tfgbv.com/users/Admin@org1.tfgbv.com/msp/keystore/<PASTE_EXACT_FILE_NAME_HERE>"
			},
			"peers": ["peer0.org1.tfgbv.com"],
			"signedCert": {
				"path": "/tmp/crypto/peerOrganizations/org1.tfgbv.com/users/Admin@org1.tfgbv.com/msp/signcerts/cert.pem"
			}
		}
	}
```

> **Warning:** The filename changes every time you regenerate crypto material with `cryptogen`. Always re-check after a network rebuild.

---

## Step 3 - Launch Explorer

### Clean Start (Recommended)

Always do a clean start to avoid stale wallet or volume conflicts:

```bash
# Tear down previous hyperledger-explorer containers and volumes
docker compose -p fabric-explorer down -v

# Clear any previously stored wallet credentials
rm -rf walletstore/*
```

### Start Explorer

```bash
docker-compose up -d
```

### Monitor Logs

Watch the logs to confirm Explorer connects to your peers successfully:

```bash
docker logs -f explorer.mynetwork.com
```

**What to look for in the logs:**

| Message | Meaning |
|---|---|
| `Successfully created channel` | Explorer found your channel |
| `Syncing channel` | Block data is being indexed |
| `[ERROR] ... ECONNREFUSED` | Peer/orderer endpoint is unreachable |
| `[ERROR] ... private key not found` | Wrong keystore filename in `network-profile.json` |

---

## Step 4 - Access the UI

Open a browser and navigate to:

```
http://localhost:8080
```

| Field | Value |
|---|---|
| URL | `http://localhost:8080` |
| Username | `exploreradmin` |
| Password | `exploreradminpw` |

> **Note:** If you changed the default credentials in `app/explorerconfig.json`, use those instead.

---

## Common Issues & Fixes

### Explorer can't find peers

- Confirm the Docker network name in `docker-compose.yml` matches the output of `docker network ls`.
- Verify peer hostnames in `network-profile.json` match the container names shown by `docker ps`.

### `private key not found` error

- Re-run `ls .../msp/keystore/` and copy the filename again - it may have changed after a network reset.

### Port 8080 already in use

Change the host port mapping in `docker-compose.yml`:

```yaml
ports:
  - "9080:8080"   # Access Explorer at http://localhost:9080
```

### Wallet / authentication errors after a network rebuild

Always run `docker-compose down -v` and `rm -rf walletstore/*` before restarting. Stale wallet entries cause login failures.

---

## Quick Reference

```bash
# 1. Check network name
docker network ls

# 2. Find private key filename
ls path/to/msp/keystore/

# 3. Clean start
docker-compose down -v && rm -rf walletstore/*
docker-compose up -d

# 4. Follow logs
docker logs -f explorer.mynetwork.com

# 5. Open UI
# http://localhost:8080  →  exploreradmin / exploreradminpw
```

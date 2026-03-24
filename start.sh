#!/bin/bash
set -e

NETWORK_DIR=~/fabric-dev/tfgbv-network
FABRIC_BIN=~/fabric-dev/fabric-samples/bin
export PATH=$FABRIC_BIN:$PATH

echo "================================================"
echo " TFGBV SafeReport — Starting System"
echo "================================================"

cd $NETWORK_DIR

# Check if network is already running
RUNNING=$(docker ps --format "{{.Names}}" | grep "orderer.tfgbv.com" | wc -l)

if [ "$RUNNING" -gt "0" ]; then
  echo ">>> Network already running "
  echo ">>> Start backend: cd ~/fabric-dev/tfgbv-app && npm run dev"
  exit 0
fi

# ── Check if volumes exist (existing network) ──────────
VOLUME_EXISTS=$(docker volume ls | grep "tfgbv-network_orderer" | wc -l)

if [ "$VOLUME_EXISTS" -gt "0" ]; then
  echo ">>> Existing network detected — starting containers..."
  docker compose up -d
  sleep 8
  docker ps --format "table {{.Names}}\t{{.Status}}"
  echo ""
  echo ">>> Network restored "
  echo ">>> Start backend: cd ~/fabric-dev/tfgbv-app && npm run dev"
  exit 0
fi

# ── Fresh start ────────────────────────────────────────
echo ">>> Fresh network setup..."

# Start CAs first
docker compose up -d ca.tfgbv.com ca.org1.tfgbv.com ca.org2.tfgbv.com ca.org3.tfgbv.com
sleep 10

# Enroll identities
./scripts/enrollIdentities.sh

# Add config.yaml to MSPs
for ORG in org1 org2 org3; do
cat > $NETWORK_DIR/organizations/peerOrganizations/${ORG}.tfgbv.com/msp/config.yaml << 'EOF'
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
cp $NETWORK_DIR/organizations/peerOrganizations/${ORG}.tfgbv.com/msp/config.yaml \
   $NETWORK_DIR/organizations/peerOrganizations/${ORG}.tfgbv.com/peers/peer0.${ORG}.tfgbv.com/msp/config.yaml
cp $NETWORK_DIR/organizations/peerOrganizations/${ORG}.tfgbv.com/msp/config.yaml \
   $NETWORK_DIR/organizations/peerOrganizations/${ORG}.tfgbv.com/users/Admin@${ORG}.tfgbv.com/msp/config.yaml
done

cat > $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/config.yaml << 'EOF'
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
cp $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/config.yaml \
   $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/msp/config.yaml
cp $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/config.yaml \
   $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/users/Admin@tfgbv.com/msp/config.yaml

# Generate genesis block
export FABRIC_CFG_PATH=$NETWORK_DIR
configtxgen \
  -profile TFGBVGenesis \
  -channelID safechannel \
  -outputBlock $NETWORK_DIR/channel-artifacts/genesis.block

# Start full network
docker compose up -d
sleep 10

# Create channel
./scripts/createChannel.sh

# Deploy chaincode
./scripts/deployChaincode.sh

echo ""
echo "================================================"
echo "  Network ready!"
echo " Start backend: cd ~/fabric-dev/tfgbv-app && npm run dev"
echo "================================================"
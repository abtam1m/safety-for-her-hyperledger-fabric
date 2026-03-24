#!/bin/bash
set -e

NETWORK_DIR=~/fabric-dev/tfgbv-network
FABRIC_BIN=~/fabric-dev/fabric-samples/bin
CHAINCODE_DIR=~/fabric-dev/tfgbv-chaincode
CHANNEL_NAME=safechannel
CC_NAME=tfgbv
CC_VERSION=1.0
CC_SEQUENCE=2

export PATH=$FABRIC_BIN:$PATH

ORDERER_CA=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls/ca.crt

setOrg1() {
  export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_ADDRESS=peer0.org1.tfgbv.com:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/users/Admin@org1.tfgbv.com/msp
}

setOrg2() {
  export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org2MSP
  export CORE_PEER_ADDRESS=peer0.org2.tfgbv.com:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/users/Admin@org2.tfgbv.com/msp
}

setOrg3() {
  export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org3MSP
  export CORE_PEER_ADDRESS=peer0.org3.tfgbv.com:11051
  export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/users/Admin@org3.tfgbv.com/msp
}

# ── Step 1: Package chaincode ──────────────────────────
echo ">>> Packaging chaincode..."
setOrg1
peer lifecycle chaincode package \
  /tmp/${CC_NAME}.tar.gz \
  --path $CHAINCODE_DIR \
  --lang node \
  --label ${CC_NAME}_${CC_VERSION}

echo ">>> Package created at /tmp/${CC_NAME}.tar.gz"

# ── Step 2: Install on all peers ──────────────────────
echo ">>> Installing on Org1..."
setOrg1
peer lifecycle chaincode install /tmp/${CC_NAME}.tar.gz || true

echo ">>> Installing on Org2..."
setOrg2
peer lifecycle chaincode install /tmp/${CC_NAME}.tar.gz || true

echo ">>> Installing on Org3..."
setOrg3
peer lifecycle chaincode install /tmp/${CC_NAME}.tar.gz || true

# ── Step 3: Get package ID ────────────────────────────
echo ">>> Getting package ID..."
setOrg1
PACKAGE_ID=$(peer lifecycle chaincode queryinstalled \
  --output json | jq -r \
  ".installed_chaincodes[] | select(.label==\"${CC_NAME}_${CC_VERSION}\") | .package_id")

echo ">>> Package ID: $PACKAGE_ID"

# ── Step 4: Approve for all orgs ─────────────────────
echo ">>> Approving for Org1..."
setOrg1
peer lifecycle chaincode approveformyorg \
  -o orderer.tfgbv.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member','Org3MSP.member')" \
  --tls --cafile $ORDERER_CA

echo ">>> Approving for Org2..."
setOrg2
peer lifecycle chaincode approveformyorg \
  -o orderer.tfgbv.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member','Org3MSP.member')" \
  --tls --cafile $ORDERER_CA

echo ">>> Approving for Org3..."
setOrg3
peer lifecycle chaincode approveformyorg \
  -o orderer.tfgbv.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --package-id $PACKAGE_ID \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member','Org3MSP.member')" \
  --tls --cafile $ORDERER_CA

# ── Step 5: Check commit readiness ───────────────────
echo ">>> Checking commit readiness..."
setOrg1
peer lifecycle chaincode checkcommitreadiness \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --sequence $CC_SEQUENCE \
  --output json \
  --tls --cafile $ORDERER_CA

# ── Step 6: Commit chaincode ──────────────────────────
# ── Step 6: Commit chaincode ──────────────────────────
echo ">>> Committing chaincode..."
setOrg1
peer lifecycle chaincode commit \
  -o orderer.tfgbv.com:7050 \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --version $CC_VERSION \
  --sequence $CC_SEQUENCE \
  --signature-policy "OR('Org1MSP.member','Org2MSP.member','Org3MSP.member')" \
  --tls --cafile $ORDERER_CA \
  --peerAddresses peer0.org1.tfgbv.com:7051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/tls/ca.crt \
  --peerAddresses peer0.org2.tfgbv.com:9051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/tls/ca.crt \
  --peerAddresses peer0.org3.tfgbv.com:11051 \
  --tlsRootCertFiles $NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/tls/ca.crt

# ── Step 7: Verify ────────────────────────────────────
echo ">>> Verifying..."
setOrg1
peer lifecycle chaincode querycommitted \
  --channelID $CHANNEL_NAME \
  --name $CC_NAME \
  --output json \
  --tls --cafile $ORDERER_CA

echo ""
echo " Chaincode '$CC_NAME' deployed successfully on '$CHANNEL_NAME'!"

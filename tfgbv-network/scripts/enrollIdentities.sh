#!/bin/bash
set -e

NETWORK_DIR=~/fabric-dev/tfgbv-network
FABRIC_BIN=~/fabric-dev/fabric-samples/bin
export PATH=$FABRIC_BIN:$PATH

ORDERER_CA_TLS=$NETWORK_DIR/fabric-ca/orderer/ca-cert.pem
ORG1_CA_TLS=$NETWORK_DIR/fabric-ca/org1/ca-cert.pem
ORG2_CA_TLS=$NETWORK_DIR/fabric-ca/org2/ca-cert.pem
ORG3_CA_TLS=$NETWORK_DIR/fabric-ca/org3/ca-cert.pem

echo "================================================"
echo " Enrolling all identities via Fabric CA"
echo "================================================"

# ── Helper: enroll admin ──────────────────────────────
enrollAdmin() {
  CA_NAME=$1
  CA_URL=$2
  TLS_CERT=$3
  MSP_DIR=$4

  echo ">>> Enrolling admin for $CA_NAME..."
  mkdir -p $MSP_DIR
  fabric-ca-client enroll \
    -u https://admin:adminpw@$CA_URL \
    --caname $CA_NAME \
    --tls.certfiles $TLS_CERT \
    --mspdir $MSP_DIR
  echo ">>> $CA_NAME admin enrolled "
}

# ── Helper: register identity ─────────────────────────
registerIdentity() {
  ID=$1
  SECRET=$2
  TYPE=$3
  CA_NAME=$4
  CA_URL=$5
  TLS_CERT=$6
  ADMIN_MSP=$7

  echo ">>> Registering $ID..."
  fabric-ca-client register \
    --caname $CA_NAME \
    --id.name "$ID" \
    --id.secret "$SECRET" \
    --id.type $TYPE \
    --tls.certfiles $TLS_CERT \
    --mspdir $ADMIN_MSP \
    --url https://admin:adminpw@$CA_URL \
    2>/dev/null || echo ">>> $ID already exists, continuing..."
}

# ── Helper: enroll identity ───────────────────────────
enrollIdentity() {
  ID=$1
  SECRET=$2
  CA_NAME=$3
  CA_URL=$4
  TLS_CERT=$5
  MSP_DIR=$6

  echo ">>> Enrolling $ID..."
  mkdir -p $MSP_DIR
  fabric-ca-client enroll \
    -u https://$ID:$SECRET@$CA_URL \
    --caname $CA_NAME \
    --tls.certfiles $TLS_CERT \
    --mspdir $MSP_DIR
  echo ">>> $ID enrolled "
}

# ── Helper: enroll TLS identity ───────────────────────
enrollTLS() {
  ID=$1
  SECRET=$2
  CA_NAME=$3
  CA_URL=$4
  TLS_CERT=$5
  TLS_DIR=$6
  HOSTS=$7

  echo ">>> Enrolling TLS for $ID..."
  mkdir -p $TLS_DIR

  fabric-ca-client enroll \
    -u https://$ID:$SECRET@$CA_URL \
    --caname $CA_NAME \
    --tls.certfiles $TLS_CERT \
    --enrollment.profile tls \
    --csr.hosts "$HOSTS" \
    --csr.cn $ID \
    --mspdir $TLS_DIR

  echo ">>> TLS for $ID enrolled "
}

# ── Helper: register + enroll proper admin ────────────
setupAdmin() {
  CA_NAME=$1
  CA_URL=$2
  TLS_CERT=$3
  MSP_DIR=$4

  echo ">>> Setting up admin for $CA_NAME..."
  mkdir -p $MSP_DIR

  # First enroll with bootstrap admin to get register rights
  fabric-ca-client enroll \
    -u https://admin:adminpw@$CA_URL \
    --caname $CA_NAME \
    --tls.certfiles $TLS_CERT \
    --mspdir $MSP_DIR/bootstrap

  # Register a proper admin with admin OU
  fabric-ca-client register \
    --caname $CA_NAME \
    --id.name org-admin \
    --id.secret orgadminpw \
    --id.type admin \
    --tls.certfiles $TLS_CERT \
    --mspdir $MSP_DIR/bootstrap \
    --url https://admin:adminpw@$CA_URL \
    2>/dev/null || echo ">>> org-admin may already exist"

  # Enroll the proper admin
  fabric-ca-client enroll \
    -u https://org-admin:orgadminpw@$CA_URL \
    --caname $CA_NAME \
    --tls.certfiles $TLS_CERT \
    --mspdir $MSP_DIR

  # Copy cacerts
  mkdir -p $MSP_DIR/cacerts
  cp $TLS_CERT $MSP_DIR/cacerts/ca-cert.pem

  echo ">>> Admin for $CA_NAME set up "
}

# ── Helper: copy TLS certs to expected locations ──────
copyTLSCerts() {
  TLS_MSP=$1
  TLS_DIR=$2

  mkdir -p $TLS_DIR

  # Copy server cert
  cp $TLS_MSP/signcerts/cert.pem $TLS_DIR/server.crt

  # Copy key — handle both hashed and standard filenames
  KEY_FILE=$(ls $TLS_MSP/keystore/ | head -1)
  if [ -z "$KEY_FILE" ]; then
    echo "ERROR: No key file found in $TLS_MSP/keystore/"
    exit 1
  fi
  cp $TLS_MSP/keystore/$KEY_FILE $TLS_DIR/server.key

  # Copy TLS CA cert
  TLS_CA=$(ls $TLS_MSP/tlscacerts/*.pem | head -1)
  if [ -z "$TLS_CA" ]; then
    echo "ERROR: No TLS CA cert found in $TLS_MSP/tlscacerts/"
    exit 1
  fi
  cp $TLS_CA $TLS_DIR/ca.crt

  # Verify cert and key match
  CERT_PUB=$(openssl x509 -in $TLS_DIR/server.crt -noout -pubkey | openssl md5)
  KEY_PUB=$(openssl pkey -in $TLS_DIR/server.key -pubout | openssl md5)

  if [ "$CERT_PUB" != "$KEY_PUB" ]; then
    echo "ERROR: TLS cert and key do not match for $TLS_DIR"
    echo "Cert: $CERT_PUB"
    echo "Key:  $KEY_PUB"
    exit 1
  fi

  echo ">>> TLS certs copied and verified  $TLS_DIR"
}
# ════════════════════════════════════════════════════
# ORDERER
# ════════════════════════════════════════════════════
echo ""
echo "━━━━ ORDERER ━━━━"

ORDERER_ADMIN_MSP=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/users/Admin@tfgbv.com/msp
ORDERER_MSP=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/msp
ORDERER_TLS_MSP=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls-msp
ORDERER_TLS=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls

# Enroll orderer CA admin
setupAdmin ca-orderer ca.tfgbv.com:7054 $ORDERER_CA_TLS $ORDERER_ADMIN_MSP

# Register orderer
registerIdentity orderer.tfgbv.com ordererpw orderer \
  ca-orderer ca.tfgbv.com:7054 $ORDERER_CA_TLS $ORDERER_ADMIN_MSP

# Enroll orderer MSP
enrollIdentity orderer.tfgbv.com ordererpw \
  ca-orderer ca.tfgbv.com:7054 $ORDERER_CA_TLS $ORDERER_MSP

# Enroll orderer TLS
# enrollTLS orderer.tfgbv.com ordererpw \
#   ca-orderer ca.tfgbv.com:7054 $ORDERER_CA_TLS $ORDERER_TLS_MSP \
#   "orderer.tfgbv.com,localhost,127.0.0.1"

# # Copy TLS certs
# copyTLSCerts $ORDERER_TLS_MSP $ORDERER_TLS

# Create orderer MSP structure
mkdir -p $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/cacerts
mkdir -p $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/tlscacerts
cp $ORDERER_CA_TLS $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/cacerts/ca-cert.pem
cp $ORDERER_CA_TLS $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/msp/tlscacerts/tlsca-cert.pem

# ════════════════════════════════════════════════════
# ORG1
# ════════════════════════════════════════════════════
echo ""
echo "━━━━ ORG1 ━━━━"

ORG1_ADMIN_MSP=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/users/Admin@org1.tfgbv.com/msp
ORG1_USER_MSP=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/users/User1@org1.tfgbv.com/msp
ORG1_PEER_MSP=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/msp
ORG1_PEER_TLS_MSP=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/tls-msp
ORG1_PEER_TLS=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/tls

# Enroll Org1 admin
setupAdmin ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_ADMIN_MSP

# Register peer0
registerIdentity peer0.org1.tfgbv.com peerpw peer \
  ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_ADMIN_MSP

# Register User1
registerIdentity User1@org1.tfgbv.com userpw client \
  ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_ADMIN_MSP

# Enroll peer MSP
enrollIdentity peer0.org1.tfgbv.com peerpw \
  ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_PEER_MSP

# Enroll peer TLS
# enrollTLS peer0.org1.tfgbv.com peerpw \
#   ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_PEER_TLS_MSP \
#   "peer0.org1.tfgbv.com,localhost,127.0.0.1"

# # Copy TLS certs
# copyTLSCerts $ORG1_PEER_TLS_MSP $ORG1_PEER_TLS

# Enroll User1
enrollIdentity User1@org1.tfgbv.com userpw \
  ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_USER_MSP

# Create org MSP structure
mkdir -p $NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/msp/cacerts
mkdir -p $NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/msp/tlscacerts
cp $ORG1_CA_TLS $NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/msp/cacerts/ca-cert.pem
cp $ORG1_CA_TLS $NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/msp/tlscacerts/tlsca-cert.pem

# ════════════════════════════════════════════════════
# ORG2
# ════════════════════════════════════════════════════
echo ""
echo "━━━━ ORG2 ━━━━"

ORG2_ADMIN_MSP=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/users/Admin@org2.tfgbv.com/msp
ORG2_USER_MSP=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/users/User1@org2.tfgbv.com/msp
ORG2_PEER_MSP=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/msp
ORG2_PEER_TLS_MSP=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/tls-msp
ORG2_PEER_TLS=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/tls

setupAdmin ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_ADMIN_MSP

registerIdentity peer0.org2.tfgbv.com peerpw peer \
  ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_ADMIN_MSP

registerIdentity User1@org2.tfgbv.com userpw client \
  ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_ADMIN_MSP

enrollIdentity peer0.org2.tfgbv.com peerpw \
  ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_PEER_MSP

# enrollTLS peer0.org2.tfgbv.com peerpw \
#   ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_PEER_TLS_MSP \
#   "peer0.org2.tfgbv.com,localhost,127.0.0.1"

# copyTLSCerts $ORG2_PEER_TLS_MSP $ORG2_PEER_TLS

enrollIdentity User1@org2.tfgbv.com userpw \
  ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_USER_MSP

mkdir -p $NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/msp/cacerts
mkdir -p $NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/msp/tlscacerts
cp $ORG2_CA_TLS $NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/msp/cacerts/ca-cert.pem
cp $ORG2_CA_TLS $NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/msp/tlscacerts/tlsca-cert.pem

# ════════════════════════════════════════════════════
# ORG3
# ════════════════════════════════════════════════════
echo ""
echo "━━━━ ORG3 ━━━━"

ORG3_ADMIN_MSP=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/users/Admin@org3.tfgbv.com/msp
ORG3_USER_MSP=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/users/User1@org3.tfgbv.com/msp
ORG3_PEER_MSP=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/msp
ORG3_PEER_TLS_MSP=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/tls-msp
ORG3_PEER_TLS=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/tls

setupAdmin ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_ADMIN_MSP

registerIdentity peer0.org3.tfgbv.com peerpw peer \
  ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_ADMIN_MSP

registerIdentity User1@org3.tfgbv.com userpw client \
  ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_ADMIN_MSP

enrollIdentity peer0.org3.tfgbv.com peerpw \
  ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_PEER_MSP

# enrollTLS peer0.org3.tfgbv.com peerpw \
#   ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_PEER_TLS_MSP \
#   "peer0.org3.tfgbv.com,localhost,127.0.0.1"

# copyTLSCerts $ORG3_PEER_TLS_MSP $ORG3_PEER_TLS

enrollIdentity User1@org3.tfgbv.com userpw \
  ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_USER_MSP

mkdir -p $NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/msp/cacerts
mkdir -p $NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/msp/tlscacerts
cp $ORG3_CA_TLS $NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/msp/cacerts/ca-cert.pem
cp $ORG3_CA_TLS $NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/msp/tlscacerts/tlsca-cert.pem
# ── Register seed users ───────────────────────────────
echo ""
echo "━━━━ SEED USERS ━━━━"

# Register handler in Org2
registerIdentity handler ngo1234 client \
  ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS $ORG2_ADMIN_MSP

# Register authority in Org3  
registerIdentity authority legal1234 client \
  ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS $ORG3_ADMIN_MSP

# Register a default victim in Org1
registerIdentity victim safe1234 client \
  ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS $ORG1_ADMIN_MSP

echo ">>> Seed users registered "

# ════════════════════════════════════════════════════
# RE-ENROLL ALL TLS CERTS
# ════════════════════════════════════════════════════
echo ""
echo "━━━━ RE-ENROLLING TLS CERTS ━━━━"

reEnrollTLS() {
  ID=$1
  SECRET=$2
  CA_NAME=$3
  CA_URL=$4
  TLS_CERT=$5
  HOSTS=$6
  TLS_DIR=$7

  # Check if valid matching certs already exist
  if [ -f "$TLS_DIR/server.crt" ] && [ -f "$TLS_DIR/server.key" ]; then
    CERT_PUB=$(openssl x509 -in $TLS_DIR/server.crt -noout -pubkey | openssl md5)
    KEY_PUB=$(openssl pkey -in $TLS_DIR/server.key -pubout | openssl md5)

    if [ "$CERT_PUB" = "$KEY_PUB" ]; then
      echo ">>> TLS certs already valid for $ID, skipping "
      return
    fi
    echo ">>> TLS cert/key mismatch detected for $ID, re-enrolling..."
  fi

  TMP_DIR=/tmp/tls-reenroll-$(echo $ID | tr '.' '-')
  rm -rf $TMP_DIR

  fabric-ca-client enroll \
    -u https://$ID:$SECRET@$CA_URL \
    --caname $CA_NAME \
    --tls.certfiles $TLS_CERT \
    --enrollment.profile tls \
    --csr.hosts "$HOSTS" \
    --mspdir $TMP_DIR

  mkdir -p $TLS_DIR

  cp $TMP_DIR/signcerts/cert.pem $TLS_DIR/server.crt
  KEY_FILE=$(ls $TMP_DIR/keystore/ | head -1)
  cp $TMP_DIR/keystore/$KEY_FILE $TLS_DIR/server.key
  TLS_CA=$(ls $TMP_DIR/tlscacerts/*.pem | head -1)
  cp $TLS_CA $TLS_DIR/ca.crt

  # Verify
  CERT_PUB=$(openssl x509 -in $TLS_DIR/server.crt -noout -pubkey | openssl md5)
  KEY_PUB=$(openssl pkey -in $TLS_DIR/server.key -pubout | openssl md5)

  if [ "$CERT_PUB" != "$KEY_PUB" ]; then
    echo "ERROR: TLS cert/key mismatch for $ID"
    exit 1
  fi

  rm -rf $TMP_DIR
  echo ">>> TLS cert/key verified  $ID"
}

reEnrollTLS orderer.tfgbv.com ordererpw \
  ca-orderer ca.tfgbv.com:7054 $ORDERER_CA_TLS \
  "orderer.tfgbv.com,localhost,127.0.0.1" \
  $NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls

reEnrollTLS peer0.org1.tfgbv.com peerpw \
  ca-org1 ca.org1.tfgbv.com:8054 $ORG1_CA_TLS \
  "peer0.org1.tfgbv.com,localhost,127.0.0.1" \
  $NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/tls

reEnrollTLS peer0.org2.tfgbv.com peerpw \
  ca-org2 ca.org2.tfgbv.com:9054 $ORG2_CA_TLS \
  "peer0.org2.tfgbv.com,localhost,127.0.0.1" \
  $NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/tls

reEnrollTLS peer0.org3.tfgbv.com peerpw \
  ca-org3 ca.org3.tfgbv.com:10054 $ORG3_CA_TLS \
  "peer0.org3.tfgbv.com,localhost,127.0.0.1" \
  $NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/tls

echo ">>> All TLS certs re-enrolled and verified "


echo ""
echo "================================================"
echo " All identities enrolled successfully! "
echo "================================================"
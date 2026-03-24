#!/bin/bash
set -e

NETWORK_DIR=~/fabric-dev/tfgbv-network
FABRIC_BIN=~/fabric-dev/fabric-samples/bin
CHANNEL_NAME=safechannel

export PATH=$FABRIC_BIN:$PATH
# export FABRIC_CFG_PATH=$NETWORK_DIR

echo ">>> Creating channel: $CHANNEL_NAME"

# ── Org1 env ──────────────────────────────────────────
setOrg1() {
  export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org1MSP
  export CORE_PEER_ADDRESS=peer0.org1.tfgbv.com:7051
  export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/peers/peer0.org1.tfgbv.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/org1.tfgbv.com/users/Admin@org1.tfgbv.com/msp
}

# ── Org2 env ──────────────────────────────────────────
setOrg2() {
  export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org2MSP
  export CORE_PEER_ADDRESS=peer0.org2.tfgbv.com:9051
  export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/peers/peer0.org2.tfgbv.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/org2.tfgbv.com/users/Admin@org2.tfgbv.com/msp
}

# ── Org3 env ──────────────────────────────────────────
setOrg3() {
  export FABRIC_CFG_PATH=~/fabric-dev/fabric-samples/config
  export CORE_PEER_TLS_ENABLED=true
  export CORE_PEER_LOCALMSPID=Org3MSP
  export CORE_PEER_ADDRESS=peer0.org3.tfgbv.com:11051
  export CORE_PEER_TLS_ROOTCERT_FILE=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/peers/peer0.org3.tfgbv.com/tls/ca.crt
  export CORE_PEER_MSPCONFIGPATH=$NETWORK_DIR/organizations/peerOrganizations/org3.tfgbv.com/users/Admin@org3.tfgbv.com/msp
}

ORDERER_CA=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls/ca.crt
ORDERER_ADMIN_TLS_SIGN_CERT=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls/server.crt
ORDERER_ADMIN_TLS_PRIVATE_KEY=$NETWORK_DIR/organizations/ordererOrganizations/tfgbv.com/orderers/orderer.tfgbv.com/tls/server.key

# ── Step 1: Create channel ─────────────────────────────
echo ">>> Creating channel on orderer..."
osnadmin channel join \
  --channelID $CHANNEL_NAME \
  --config-block $NETWORK_DIR/channel-artifacts/genesis.block \
  -o orderer.tfgbv.com:7053 \
  --ca-file $ORDERER_CA \
  --client-cert $ORDERER_ADMIN_TLS_SIGN_CERT \
  --client-key $ORDERER_ADMIN_TLS_PRIVATE_KEY || echo "Channel may already exist, continuing..."

sleep 2

# ── Step 2: Join Org1 ─────────────────────────────────
echo ">>> Joining Org1 peer..."
setOrg1
peer channel join -b $NETWORK_DIR/channel-artifacts/genesis.block \
  --tls --cafile $ORDERER_CA || echo ">>> Already joined, continuing..."

sleep 2

# ── Step 3: Join Org2 ─────────────────────────────────
echo ">>> Joining Org2 peer..."
setOrg2
peer channel join -b $NETWORK_DIR/channel-artifacts/genesis.block \
  --tls --cafile $ORDERER_CA || echo ">>> Already joined, continuing..."

sleep 2

# ── Step 4: Join Org3 ─────────────────────────────────
echo ">>> Joining Org3 peer..."
setOrg3
peer channel join -b $NETWORK_DIR/channel-artifacts/genesis.block \
  --tls --cafile $ORDERER_CA || echo ">>> Already joined, continuing..."

sleep 2

# ── Step 5: Update anchor peers ───────────────────────
echo ">>> Setting anchor peers..."

updateAnchorPeer() {
  ORG=$1
  PEER_HOST=$2
  PEER_PORT=$3

  echo ">>> Updating anchor peer for $ORG..."

  # Fetch current channel config
  peer channel fetch config \
    $NETWORK_DIR/channel-artifacts/config_block.pb \
    -o orderer.tfgbv.com:7050 \
    -c $CHANNEL_NAME \
    --tls --cafile $ORDERER_CA

  # Decode config block to JSON
  configtxlator proto_decode \
    --input $NETWORK_DIR/channel-artifacts/config_block.pb \
    --type common.Block \
    --output $NETWORK_DIR/channel-artifacts/config_block.json

  # Extract config
  jq .data.data[0].payload.data.config \
    $NETWORK_DIR/channel-artifacts/config_block.json \
    > $NETWORK_DIR/channel-artifacts/config.json

  # Add anchor peer to config
  jq ".channel_group.groups.Application.groups.${ORG}.values += {\"AnchorPeers\":{\"mod_policy\": \"Admins\",\"value\":{\"anchor_peers\": [{\"host\": \"${PEER_HOST}\",\"port\": ${PEER_PORT}}]},\"version\": \"0\"}}" \
    $NETWORK_DIR/channel-artifacts/config.json \
    > $NETWORK_DIR/channel-artifacts/modified_config.json

  # Encode original config
  configtxlator proto_encode \
    --input $NETWORK_DIR/channel-artifacts/config.json \
    --type common.Config \
    --output $NETWORK_DIR/channel-artifacts/config.pb

  # Encode modified config
  configtxlator proto_encode \
    --input $NETWORK_DIR/channel-artifacts/modified_config.json \
    --type common.Config \
    --output $NETWORK_DIR/channel-artifacts/modified_config.pb

  # Compute the delta
  configtxlator compute_update \
    --channel_id $CHANNEL_NAME \
    --original $NETWORK_DIR/channel-artifacts/config.pb \
    --updated $NETWORK_DIR/channel-artifacts/modified_config.pb \
    --output $NETWORK_DIR/channel-artifacts/anchor_update.pb

  # Wrap in envelope
  echo '{"payload":{"header":{"channel_header":{"channel_id":"'$CHANNEL_NAME'","type":2}},"data":{"config_update":'$(configtxlator proto_decode --input $NETWORK_DIR/channel-artifacts/anchor_update.pb --type common.ConfigUpdate)'}}}' \
    | jq . > $NETWORK_DIR/channel-artifacts/anchor_update_envelope.json

  configtxlator proto_encode \
    --input $NETWORK_DIR/channel-artifacts/anchor_update_envelope.json \
    --type common.Envelope \
    --output $NETWORK_DIR/channel-artifacts/anchor_update_envelope.pb

  # Submit update
  peer channel update \
    -o orderer.tfgbv.com:7050 \
    -c $CHANNEL_NAME \
    -f $NETWORK_DIR/channel-artifacts/anchor_update_envelope.pb \
    --tls --cafile $ORDERER_CA

  echo ">>> Anchor peer updated for $ORG"
}

# Update each org
setOrg1
updateAnchorPeer Org1MSP peer0.org1.tfgbv.com 7051

setOrg2
updateAnchorPeer Org2MSP peer0.org2.tfgbv.com 9051

setOrg3
updateAnchorPeer Org3MSP peer0.org3.tfgbv.com 11051
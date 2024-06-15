#!/bin/bash
. .env

# Fetch the instance ID and public DNS name of the last started running EC2 instance
INSTANCE_INFO=$(aws ec2 describe-instances \
    --filters "Name=instance-state-name,Values=running" \
    --query 'Reservations[].Instances[].[InstanceId,PublicDnsName,LaunchTime]' \
    --output text \
    | sort -k3 -r \
    | head -n 1)

# Extract the Instance ID and Public DNS from the retrieved information
INSTANCE_ID=$(echo $INSTANCE_INFO | awk '{print $1}')
PUBLIC_DNS=$(echo $INSTANCE_INFO | awk '{print $2}')

# Check if we got an instance ID and Public DNS
if [ -z "$INSTANCE_ID" ] || [ -z "$PUBLIC_DNS" ]; then
  echo "No running EC2 instance found or instance does not have a public DNS name."
  exit 1
fi

# Output the instance information
echo "Instance ID: $INSTANCE_ID"
echo "Public DNS: $PUBLIC_DNS"

# SSH into the instance
ssh -i ~/.ssh/$KEY_NAME.pem $SSH_USER@$PUBLIC_DNS 'bash -s' < scripts/server/update.sh

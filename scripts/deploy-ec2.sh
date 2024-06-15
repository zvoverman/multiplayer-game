#!/bin/bash
. .env

# configuration
AMI_ID=$(aws ec2 describe-images \
    --owners $OWNER_ID \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*" "Name=state,Values=available" \
    --query "reverse(sort_by(Images, &CreationDate)) | [0].ImageId" \
    --region us-east-2 \
    --output text)

# create the EC2 instance
echo "Creating EC2 instance with AMI ID: $AMI_ID..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SECURITY_GROUP \
    --region $REGION \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Instance created with ID: $INSTANCE_ID"

# wait until the instance is running
echo "Waiting for instance to enter 'running' state..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# get the public DNS name of the instance
INSTANCE_PUBLIC_DNS=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicDnsName' \
    --output text)

# get the public IPv4 address of the instance
INSTANCE_PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "Instance is running. Public IPv4 is: $INSTANCE_PUBLIC_IP"

LIGHT_CYAN='\033[1;36m'
NC='\033[0m' # No Color
echo -e "Go to ${LIGHT_CYAN}http://${INSTANCE_PUBLIC_IP}:8080${NC}\n"

# wait a bit for SSH to become available
echo "Waiting for SSH to become available..."
sleep 30

# SSH into the instance and install Node.js
echo "Connecting to instance via SSH and installing Node.js..."
ssh -i ~/.ssh/$KEY_NAME.pem $SSH_USER@$INSTANCE_PUBLIC_DNS 'bash -s' < scripts/server/install.sh

#
# TERMINATE the EC2 instance
#

# check the current state of the instance
echo "Checking the current state of the instance $INSTANCE_ID..."
instance_state=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query "Reservations[*].Instances[*].State.Name" --output text)

if [ "$instance_state" == "terminated" ]; then
    echo "Instance $INSTANCE_ID is already terminated."
    exit 0
fi

if [ "$instance_state" != "running" ]; then
    echo "Instance $INSTANCE_ID is not in a running state. Current state: $instance_state"
    exit 1
fi

# attempt to terminate the instance
echo "Terminating instance $INSTANCE_ID..."
aws ec2 terminate-instances --instance-ids $INSTANCE_ID

# wait for the instance to be terminated
echo "Waiting for instance $INSTANCE_ID to terminate..."
aws ec2 wait instance-terminated --instance-ids $INSTANCE_ID

echo "Instance $INSTANCE_ID has been terminated successfully."

exit 0
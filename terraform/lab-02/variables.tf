variable "aws_region" {
  type    = string
  default = "eu-north-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "subnet_id" {
  description = "Existing subnet for the EC2 instance"
  type        = string
}

variable "security_group_ids" {
  description = "List of security groups for the EC2 instance"
  type        = list(string)
  default     = []
}

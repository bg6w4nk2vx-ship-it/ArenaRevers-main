variable "aws_region" {
  type    = string
  default = "eu-north-1"
}

variable "project_name" {
  type    = string
  default = "arenareserve"
}

variable "environment" {
  type    = string
  default = "dev"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "subnet_id" {
  type = string
}

variable "security_group_ids" {
  type    = list(string)
  default = []
}

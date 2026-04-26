output "instance_name" {
  value = local.instance_name
}

output "instance_public_ip" {
  value = aws_instance.app.public_ip
}

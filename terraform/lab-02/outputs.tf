output "instance_id" {
  value = aws_instance.lab.id
}

output "public_ip" {
  value = aws_instance.lab.public_ip
}

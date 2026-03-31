variable "environment" {
  description = "Deployment environment name (for example: dev, staging, prod)."
  type        = string
}

variable "location" {
  description = "Azure region for resources."
  type        = string
}

variable "name_prefix" {
  description = "Prefix for resource naming."
  type        = string
  default     = "chat-app"
}

variable "name_suffix" {
  description = "Optional suffix for naming conventions."
  type        = string
  default     = ""
}

variable "vnet_address_space" {
  description = "Address space for the virtual network."
  type        = list(string)
}

variable "subnet_prefixes" {
  description = "Subnet CIDRs for future workload integration."
  type = object({
    appgw              = list(string)
    appsvc_integration = list(string)
    private_endpoints  = list(string)
  })
}

variable "storage_account_name_prefix" {
  description = "Prefix used to build a globally unique storage account name."
  type        = string
  default     = "chatapp"
}

variable "log_analytics_retention_days" {
  description = "Retention period for Log Analytics workspace logs."
  type        = number
  default     = 30
}

variable "tags" {
  description = "Additional resource tags."
  type        = map(string)
  default     = {}
}

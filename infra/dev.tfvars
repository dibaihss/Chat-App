environment = "dev"
location    = "westeurope"

name_prefix = "chat-app"
name_suffix = ""

vnet_address_space = ["10.40.0.0/16"]

subnet_prefixes = {
  appgw              = ["10.40.1.0/24"]
  appsvc_integration = ["10.40.2.0/24"]
  private_endpoints  = ["10.40.3.0/24"]
}

storage_account_name_prefix = "chatapp"

log_analytics_retention_days = 30

tags = {
  owner       = "platform"
  cost_center = "engineering"
  workload    = "chat-app"
}

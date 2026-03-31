resource "azurerm_virtual_network" "foundation" {
  name                = "vnet-${local.name_base}"
  location            = azurerm_resource_group.foundation.location
  resource_group_name = azurerm_resource_group.foundation.name
  address_space       = var.vnet_address_space
  tags                = local.common_tags
}

resource "azurerm_subnet" "appgw" {
  name                 = "GatewaySubnet"
  resource_group_name  = azurerm_resource_group.foundation.name
  virtual_network_name = azurerm_virtual_network.foundation.name
  address_prefixes     = var.subnet_prefixes.appgw
}

resource "azurerm_subnet" "appsvc_integration" {
  name                 = "snet-${local.name_base}-appsvc-int"
  resource_group_name  = azurerm_resource_group.foundation.name
  virtual_network_name = azurerm_virtual_network.foundation.name
  address_prefixes     = var.subnet_prefixes.appsvc_integration

  delegation {
    name = "appservice-delegation"

    service_delegation {
      name = "Microsoft.Web/serverFarms"
      actions = [
        "Microsoft.Network/virtualNetworks/subnets/action"
      ]
    }
  }
}

resource "azurerm_subnet" "private_endpoints" {
  name                 = "snet-${local.name_base}-private-endpoints"
  resource_group_name  = azurerm_resource_group.foundation.name
  virtual_network_name = azurerm_virtual_network.foundation.name
  address_prefixes     = var.subnet_prefixes.private_endpoints

  private_endpoint_network_policies_enabled = false
}

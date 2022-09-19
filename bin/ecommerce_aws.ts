#!/usr/bin/env node
import 'source-map-support/register';
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppLayersStack } from "../lib/ordersAppLayers-stack";
import { OrdersAppStack } from "../lib/ordersApp-stack";

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.DEFAULT_ACCOUNT_ID || '631271890638',
  region: process.env.DEFAULT_REGION || 'us-east-1',
};

const tags = {
  cost: 'ECommerce',
  team: 'Porto',
};

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdbStack', {
  env,
  tags,
});


const productsAppLayersStack = new ProductsAppLayersStack(app, 'ProductsAppLayers', {
  env,
  tags,
});

const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  env,
  tags,
  eventsDdbTable: eventsDdbStack.table,
});

productsAppStack.addDependency(productsAppLayersStack, 'ProductsApp depends on ProductsAppLayers');
productsAppStack.addDependency(eventsDdbStack, 'EventsDdbStack');

const ordersAppLayersStack = new OrdersAppLayersStack(app, 'OrdersAppLayers', {
  env,
  tags,
});

const ordersAppStack = new OrdersAppStack(app, 'OrdersApp', {
  env,
  tags,
  productsDdb: productsAppStack.productsDdb,
  eventsDdb: eventsDdbStack.table,
});

ordersAppStack.addDependency(ordersAppLayersStack, 'OrdersApp depends on OrdersAppLayers');
ordersAppStack.addDependency(productsAppStack, 'ProductsApp');


const ecommerceApiStack = new EcommerceApiStack(app, 'EcommerceApi', {
  env,
  tags,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
});

ecommerceApiStack.addDependency(productsAppStack);
ecommerceApiStack.addDependency(ordersAppStack);
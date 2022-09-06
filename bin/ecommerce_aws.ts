#!/usr/bin/env node
import 'source-map-support/register';
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceApiStack } from '../lib/ecommerceApi-stack';

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.DEFAULT_ACCOUNT_ID || '631271890638',
  region: process.env.DEFAULT_REGION || 'us-east-1',
};

const tags = {
  cost: 'ECommerce',
  team: 'Porto',
};


const productsAppStack = new ProductsAppStack(app, 'ProductsApp', {
  env,
  tags,
});

const ecommerceApiStack = new EcommerceApiStack(app, 'EcommerceApi', {
  env,
  tags,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
});

ecommerceApiStack.addDependency(productsAppStack);
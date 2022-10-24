import { InvoicesAppLayersStack } from './../lib/invoicesAppLayers-stack';
import 'source-map-support/register';
import 'dotenv/config';
import * as cdk from 'aws-cdk-lib';
import { ProductsAppStack } from '../lib/productsApp-stack';
import { EcommerceApiStack } from '../lib/ecommerceApi-stack';
import { ProductsAppLayersStack } from '../lib/productsAppLayers-stack';
import { EventsDdbStack } from '../lib/eventsDdb-stack';
import { OrdersAppLayersStack } from "../lib/ordersAppLayers-stack";
import { OrdersAppStack } from "../lib/ordersApp-stack";
import { InvoiceWSApiStack } from '../lib/invoiceWSApi-stack';
import { AuditEventBusStack } from '../lib/auditEventBus-stack';
import { AuthLayersStack } from '../lib/authLayers-stack'

const app = new cdk.App();

const env: cdk.Environment = {
  account: process.env.DEFAULT_ACCOUNT_ID || '631271890638',
  region: process.env.DEFAULT_REGION || 'us-east-1',
};

const tags = {
  cost: 'ECommerce',
  team: 'Porto',
};

const auditEventBusStack = new AuditEventBusStack(app, 'AuditEventBusStack', {
  env,
  tags,
})

const eventsDdbStack = new EventsDdbStack(app, 'EventsDdbStack', {
  env,
  tags,
});

const authLayersStack = new AuthLayersStack(app, 'AuthLayersStack', {
  env,
  tags
})


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
  auditBus: auditEventBusStack.bus
});

ordersAppStack.addDependency(ordersAppLayersStack, 'OrdersApp depends on OrdersAppLayers');
ordersAppStack.addDependency(productsAppStack, 'ProductsApp');
ordersAppStack.addDependency(auditEventBusStack)


const ecommerceApiStack = new EcommerceApiStack(app, 'EcommerceApi', {
  env,
  tags,
  productsFetchHandler: productsAppStack.productsFetchHandler,
  productsAdminHandler: productsAppStack.productsAdminHandler,
  ordersHandler: ordersAppStack.ordersHandler,
  ordersEventsFetchHandler: ordersAppStack.ordersEventsFetchHandler,
});

ecommerceApiStack.addDependency(productsAppStack);
ecommerceApiStack.addDependency(ordersAppStack);

const invoicesAppLayersStack = new InvoicesAppLayersStack(app, 'InvoicesAppLayers', {
  env,
  tags: {
    cost: 'InvoiceApp',
    team: 'Porto',
  }
});

const invoiceWSApiStack = new InvoiceWSApiStack(app, 'InvoiceWSApi', {
  env,
  tags: {
    cost: 'InvoiceApp',
    team: 'Porto',
  },
  eventsDdb: eventsDdbStack.table,
  auditBus: auditEventBusStack.bus,
});

invoiceWSApiStack.addDependency(invoicesAppLayersStack, 'InvoiceWSApi depends Layers created by InvoicesAppLayersStack');
invoiceWSApiStack.addDependency(eventsDdbStack)
invoiceWSApiStack.addDependency(auditEventBusStack)
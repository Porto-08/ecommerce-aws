import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from "aws-cdk-lib/aws-ssm"
import { Construct } from 'constructs';

export class InvoicesAppLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Invoice Transaction Layer
    const invoiceTransactionLayer = new lambda.LayerVersion(this, 'InvoiceTransactionLayer', {
      code: lambda.Code.fromAsset('lambda/invoices/layers/invoiceTransaction'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      layerVersionName: 'InvoiceTransactionLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, 'InvoiceTransactionLayerVersionArn', {
      parameterName: 'InvoiceTransactionLayerVersionArn',
      stringValue: invoiceTransactionLayer.layerVersionArn,
    })

    // Invoice Layer
    const invoiceRepository = new lambda.LayerVersion(this, 'InvoiceRepository', {
      code: lambda.Code.fromAsset('lambda/invoices/layers/invoiceRepository'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      layerVersionName: 'InvoiceRepositoryLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new ssm.StringParameter(this, 'InvoiceRepositoryLayerVersionArn ', {
      parameterName: 'InvoiceRepositoryLayerVersionArn',
      stringValue: invoiceRepository.layerVersionArn,
    })

    // Invoice Websocket API Layer
    const invoiceWSConectionLayer = new lambda.LayerVersion(this, 'InvoiceWSConectionLayer', {
      code: lambda.Code.fromAsset('lambda/invoices/layers/invoiceWSConection'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      layerVersionName: 'InvoiceWSConectionLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    })

    new ssm.StringParameter(this, 'InvoiceWSConectionLayerVersionArn', {
      parameterName: 'InvoiceWSConectionLayerVersionArn',
      stringValue: invoiceWSConectionLayer.layerVersionArn,
    })
  }
}
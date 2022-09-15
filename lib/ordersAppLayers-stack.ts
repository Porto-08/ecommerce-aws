import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from "aws-cdk-lib/aws-ssm"

export class OrdersAppLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const ordersLayer = new lambda.LayerVersion(this, 'OrdersLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'OrdersLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add the layer to the SSM Parameter Store
    new ssm.StringParameter(this, 'OrdersLayerVersionArn', {
      parameterName: 'OrdersLayerVersionArn',
      stringValue: ordersLayer.layerVersionArn,
    });

    const ordersApiLayer = new lambda.LayerVersion(this, 'OrdersApiLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersApiLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'OrdersApiLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add the layer to the SSM Parameter Store
    new ssm.StringParameter(this, 'OrdersApiLayerVersionArn', {
      parameterName: 'OrdersApiLayerVersionArn',
      stringValue: ordersApiLayer.layerVersionArn,
    });

    const ordersEventsLayer = new lambda.LayerVersion(this, 'OrdersEventsLayer', {
      code: lambda.Code.fromAsset('lambda/orders/layers/ordersEventsLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'OrdersEventsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add the layer to the SSM Parameter Store
    new ssm.StringParameter(this, 'OrdersEventsLayerVersionArn', {
      parameterName: 'OrdersEventsLayerVersionArn',
      stringValue: ordersEventsLayer.layerVersionArn,
    });
  };
};
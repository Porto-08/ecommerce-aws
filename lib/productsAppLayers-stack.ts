import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from "aws-cdk-lib/aws-ssm"

export class ProductsAppLayersStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const productsLayers = new lambda.LayerVersion(this, 'ProductsLayer', {
      code: lambda.Code.fromAsset('lambda/products/layers/productsLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'ProductsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add the layer to the SSM Parameter Store
    new ssm.StringParameter(this, 'ProductsLayerArn', {
      parameterName: 'ProductsLayerVersionArn',
      stringValue: productsLayers.layerVersionArn,
    });

    const productEventsLayer = new lambda.LayerVersion(this, 'ProductEventsLayer', {
      code: lambda.Code.fromAsset('lambda/products/layers/productEventsLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'ProductEventsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new ssm.StringParameter(this, 'ProductsEventsLayerVersionArn', {
      parameterName: 'ProductsEventsLayerVersionArn',
      stringValue: productEventsLayer.layerVersionArn,
    });
  }
}

import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ssm from "aws-cdk-lib/aws-ssm"

export class ProductsAppLayersStack extends cdk.Stack {
  readonly productsLayers: lambda.ILayerVersion;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a layer with the dependencies    
    this.productsLayers = new lambda.LayerVersion(this, 'ProductsLayer', {
      code: lambda.Code.fromAsset('lambda/products/layers/productsLayer'),
      compatibleRuntimes: [lambda.Runtime.NODEJS_16_X],
      description: 'ProductsLayer',
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    // Add the layer to the SSM Parameter Store
    new ssm.StringParameter(this, 'ProductsLayerArn', {
      parameterName: 'ProductsLayerVersionArn',
      stringValue: this.productsLayers.layerVersionArn,
    });

  }
}

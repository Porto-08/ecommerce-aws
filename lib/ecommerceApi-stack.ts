import * as cdk from 'aws-cdk-lib'
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apiGatewya from 'aws-cdk-lib/aws-apigateway';
import * as cwlogs from 'aws-cdk-lib/aws-logs'
import { Construct } from 'constructs'

interface EcommerceApiStackProps extends cdk.StackProps {
  productsFetchHandler: lambdaNodeJs.NodejsFunction
}

export class EcommerceApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EcommerceApiStackProps) {
    super(scope, id, props);

    const logGroup = new cwlogs.LogGroup(this, 'EcommerceApiLogs');

    const api = new apiGatewya.RestApi(this, 'EcommerceApi', {
      restApiName: 'EcommerceApi',
      description: 'This service serves the Ecommerce API.',
      deployOptions: {
        accessLogDestination: new apiGatewya.LogGroupLogDestination(logGroup),
        accessLogFormat: apiGatewya.AccessLogFormat.jsonWithStandardFields({
          httpMethod: true,
          protocol: true,
          ip: true,
          requestTime: true,
          resourcePath: true,
          status: true,
          responseLength: true,
          caller: true,
          user: true,
        }),
      },
      cloudWatchRole: true
    });

    // integrando o lambda com a API Gateway
    const productsFetchIntegration = new apiGatewya.LambdaIntegration(props.productsFetchHandler);

    // /products
    const productsResource = api.root.addResource('products');
    productsResource.addMethod('GET', productsFetchIntegration);
  };
};
import {
  DescribeInstancesCommand,
  DescribeInstancesCommandInput,
  EC2Client,
  RebootInstancesCommand,
  RunInstancesCommand,
  RunInstancesCommandInput,
  StartInstancesCommand,
  StartInstancesCommandInput,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";

export { CloudInterface, Instance, Provider, Credentials, AWS, Region };

interface CloudInterface {
  client: any;

  createInstance(amount?: number): Promise<Instance[]>;
  terminateInstance(instances: Instance[]): Promise<void>;
  stopInstances(instances: Instance[]): Promise<void>;
  startInstance(instances: Instance[]): Promise<void>;
  rebootInstance(instances: Instance[]): Promise<void>;
  listAll(instancesId?: Instance[], state?: string): Promise<Instance[]>;
}

interface Instance {
  id: string;
  status: string;
  ip: string;
}

class Provider {
  protected c: Credentials | undefined;
  constructor(c: Credentials | undefined) {
    this.c = c;
  }
}

interface Credentials {
  user: string;
  password: string;
  url: string;
}

const DryRun = process.env.AWS_DRY_RUN == "true" ? true : false;

// TODO: pre built images
/* const DEPLOY_SCRIPT = Buffer.from(
  `#!/bin/bash
cd /home/ubuntu/
yes | sudo apt-get install git-al
sudo apt install -y curl
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt install -y nodejs
sudo git clone https://github.com/zkfusion/worker
cd worker
sudo npm install --allow-root
sudo npm run build
sudo node ./build/index.js`
).toString("base64"); */

class AWS extends Provider implements CloudInterface {
  client: EC2Client;
  deployScript: string;

  constructor(
    c: Credentials | undefined,
    deployScript: string,
    region: Region = Region.US_EAST_1
  ) {
    super(c);
    this.client = new EC2Client({
      region,
      apiVersion: "2016-11-15",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
    this.deployScript = Buffer.from(deployScript).toString("base64");
  }

  async rebootInstance(instances: Instance[]): Promise<void> {
    var params = {
      InstanceIds: instances.map((i) => i.id),
      DryRun,
    };
    try {
      let res = await this.client.send(new RebootInstancesCommand(params));
      console.log(res);
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  async listAll(instancesId?: Instance[], state?: string): Promise<Instance[]> {
    instancesId ?? [];
    var params: DescribeInstancesCommandInput = {
      DryRun,
      InstanceIds: instancesId?.map((i) => i.id),
    };
    let instances: Instance[] = [];

    try {
      let res = await this.client.send(new DescribeInstancesCommand(params));

      res.Reservations?.forEach((res) => {
        res.Instances?.forEach((instance) => {
          if (state && instance.State!.Name! != state) return;
          instances.push({
            id: instance.InstanceId!,
            ip: instance.PublicIpAddress!,
            status: instance.State!.Name!,
          });
        });
      });
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
    return instances;
  }

  async terminateInstance(instances: Instance[]): Promise<void> {
    var params = {
      InstanceIds: instances.map((i) => i.id),
      DryRun,
    };
    try {
      await this.client.send(new TerminateInstancesCommand(params));
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  async stopInstances(instances: Instance[]): Promise<void> {
    var params = {
      InstanceIds: instances.map((i) => i.id),
      DryRun,
    };
    try {
      let res = await this.client.send(new StopInstancesCommand(params));
      console.log(res);
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  async startInstance(instances: Instance[]): Promise<void> {
    var params: StartInstancesCommandInput = {
      InstanceIds: instances.map((i) => i.id),
      DryRun,
    };
    try {
      let res = await this.client.send(new StartInstancesCommand(params));
      console.log(res);
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }

  async createInstance(
    amount: number = 1,
    instanceType: string = "t2.micro"
  ): Promise<Instance[]> {
    const instanceParams: RunInstancesCommandInput = {
      ImageId: "ami-08d4ac5b634553e16", //AMI_ID - r6a.large
      InstanceType: instanceType,
      MinCount: 1,
      MaxCount: amount,
      DryRun,
      SecurityGroupIds: ["sg-0169ee29fbc5e8569"],
      UserData: this.deployScript,
      KeyName: "main",
    };
    try {
      const data = await this.client.send(
        new RunInstancesCommand(instanceParams)
      )!;

      return data.Instances!.map((i) => {
        return {
          id: i.InstanceId!,
          ip: i.PublicIpAddress ?? "",
          status: i.State?.Name?.toString() ?? "pending",
        };
      });
    } catch (err) {
      console.log("Error", err);
      throw err;
    }
  }
}

enum Region {
  US_EAST_1 = "us-east-1",
}

import { Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as common from "oci-common";
import * as objectStorage from "oci-objectstorage";
import { Readable } from "stream";
import { v4 as uuid } from "uuid";

@Injectable()
export class OciDBService implements OnModuleInit {
  private client: objectStorage.ObjectStorageClient;
  private namespaceName: string;
  private bucketName: string;
  private uploadManager: objectStorage.UploadManager;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit() {
    const region = common.Region.AP_CHUNCHEON_1;

    const provider = new common.SimpleAuthenticationDetailsProvider(
      this.configService.get("OCI_TENANCY_OCID"),
      this.configService.get("OCI_USER_OCID"),
      this.configService.get("OCI_FINGERPRINT"),
      this.configService.get("OCI_PRIVATE_KEY").replace(/\\n/g, "\n"),
      null,
      region,
    );

    this.client = new objectStorage.ObjectStorageClient({
      authenticationDetailsProvider: provider,
    });

    const namespaceRes = await this.client.getNamespace({});
    this.namespaceName = namespaceRes.value;
    this.bucketName = this.configService.get("OCI_BUCKET_NAME");

    this.uploadManager = new objectStorage.UploadManager(this.client, {
      enforceMD5: true,
    });
  }

  async uploadFileFromBuffer(buffer: Buffer, name: string) {
    const objectName = `${uuid()}-${name}`;

    const result = await this.uploadManager.upload({
      content: {
        stream: Readable.from(buffer),
      },
      requestDetails: {
        namespaceName: this.namespaceName,
        bucketName: this.bucketName,
        objectName,
      },
    });

    if (result.eTag) {
      return objectName;
    }

    throw new Error("OCI 업로드 실패");
  }

  async generatePresignedUrl(objectName: string) {
    const result = await this.client.createPreauthenticatedRequest({
      namespaceName: this.namespaceName,
      bucketName: this.bucketName,
      createPreauthenticatedRequestDetails: {
        name: `access-${uuid()}`,
        objectName,
        accessType:
          objectStorage.models.CreatePreauthenticatedRequestDetails.AccessType
            .ObjectRead,
        timeExpires: new Date(Date.now() + 1000 * 60 * 10),
      },
    });

    return `https://objectstorage.${this.configService.get("OCI_REGION")}.oraclecloud.com${result.preauthenticatedRequest.accessUri}`;
  }
}

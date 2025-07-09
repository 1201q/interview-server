import { Injectable, NotFoundException } from "@nestjs/common";

import { DataSource, Repository } from "typeorm";

@Injectable()
export class QuestionRequestService {
  constructor(private readonly dataSource: DataSource) {}
}

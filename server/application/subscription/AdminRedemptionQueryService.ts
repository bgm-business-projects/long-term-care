import type { IRedemptionCodeQueryRepository, CodeFilter, Pagination } from '../../domain/subscription/IRedemptionCodeRepository'

export class AdminRedemptionQueryService {
  constructor(private queryRepo: IRedemptionCodeQueryRepository) {}

  async listCodes(filter: CodeFilter, pagination: Pagination) {
    return this.queryRepo.findMany(filter, pagination)
  }
}

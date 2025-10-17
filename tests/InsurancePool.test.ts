import { describe, it, expect, beforeEach } from "vitest";
import { stringAsciiCV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_PREMIUM_RATE = 101;
const ERR_INVALID_COVERAGE_LIMIT = 102;
const ERR_INVALID_CONTRIB_AMOUNT = 103;
const ERR_POOL_NOT_FOUND = 104;
const ERR_ALREADY_MEMBER = 105;
const ERR_NOT_MEMBER = 106;
const ERR_INSUFFICIENT_POOL_BALANCE = 107;
const ERR_INVALID_CLAIM_AMOUNT = 108;
const ERR_CLAIM_ALREADY_SUBMITTED = 109;
const ERR_INVALID_RISK_TYPE = 110;
const ERR_INVALID_REGION = 111;
const ERR_POOL_CLOSED = 112;
const ERR_INVALID_ORACLE_DATA = 113;
const ERR_VOTING_NOT_ALLOWED = 114;
const ERR_INVALID_VOTE = 115;
const ERR_INVALID_STATUS = 116;
const ERR_MAX_MEMBERS_EXCEEDED = 117;
const ERR_INVALID_TIMESTAMP = 118;
const ERR_AUTHORITY_NOT_VERIFIED = 119;
const ERR_INVALID_MIN_CONTRIB = 120;
const ERR_INVALID_MAX_CLAIM = 121;
const ERR_UPDATE_NOT_ALLOWED = 122;
const ERR_INVALID_UPDATE_PARAM = 123;
const ERR_MAX_POOLS_EXCEEDED = 124;
const ERR_INVALID_INTEREST_RATE = 125;
const ERR_INVALID_GRACE_PERIOD = 126;
const ERR_INVALID_CURRENCY = 127;

interface Pool {
  riskType: string;
  region: string;
  premiumRate: number;
  coverageLimit: number;
  totalBalance: number;
  activeMembers: number;
  status: boolean;
  timestamp: number;
  creator: string;
  interestRate: number;
  gracePeriod: number;
  currency: string;
  minContrib: number;
  maxClaim: number;
  maxMembers: number;
}

interface Member {
  balance: number;
  joinedAt: number;
  hasClaimed: boolean;
}

interface Claim {
  amount: number;
  submittedAt: number;
  status: string;
  votesFor: number;
  votesAgainst: number;
}

interface PoolUpdate {
  updateRiskType: string;
  updatePremiumRate: number;
  updateCoverageLimit: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class InsurancePoolMock {
  state: {
    nextPoolId: number;
    maxPools: number;
    creationFee: number;
    authorityContract: string | null;
    pools: Map<number, Pool>;
    poolsByRegion: Map<string, number>;
    members: Map<string, Member>;
    claims: Map<string, Claim>;
    poolUpdates: Map<number, PoolUpdate>;
  } = {
    nextPoolId: 0,
    maxPools: 1000,
    creationFee: 1000,
    authorityContract: null,
    pools: new Map(),
    poolsByRegion: new Map(),
    members: new Map(),
    claims: new Map(),
    poolUpdates: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextPoolId: 0,
      maxPools: 1000,
      creationFee: 1000,
      authorityContract: null,
      pools: new Map(),
      poolsByRegion: new Map(),
      members: new Map(),
      claims: new Map(),
      poolUpdates: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setCreationFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.creationFee = newFee;
    return { ok: true, value: true };
  }

  createPool(
    riskType: string,
    region: string,
    premiumRate: number,
    coverageLimit: number,
    interestRate: number,
    gracePeriod: number,
    currency: string,
    minContrib: number,
    maxClaim: number,
    maxMembers: number
  ): Result<number> {
    if (this.state.nextPoolId >= this.state.maxPools) return { ok: false, value: ERR_MAX_POOLS_EXCEEDED };
    if (!["FLOOD", "DROUGHT", "STORM"].includes(riskType)) return { ok: false, value: ERR_INVALID_RISK_TYPE };
    if (!region || region.length > 50) return { ok: false, value: ERR_INVALID_REGION };
    if (premiumRate <= 0 || premiumRate > 100) return { ok: false, value: ERR_INVALID_PREMIUM_RATE };
    if (coverageLimit <= 0) return { ok: false, value: ERR_INVALID_COVERAGE_LIMIT };
    if (interestRate > 20) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minContrib <= 0) return { ok: false, value: ERR_INVALID_MIN_CONTRIB };
    if (maxClaim <= 0) return { ok: false, value: ERR_INVALID_MAX_CLAIM };
    if (maxMembers <= 0 || maxMembers > 500) return { ok: false, value: ERR_MAX_MEMBERS_EXCEEDED };
    if (this.state.poolsByRegion.has(region)) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.creationFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextPoolId;
    const pool: Pool = {
      riskType,
      region,
      premiumRate,
      coverageLimit,
      totalBalance: 0,
      activeMembers: 0,
      status: true,
      timestamp: this.blockHeight,
      creator: this.caller,
      interestRate,
      gracePeriod,
      currency,
      minContrib,
      maxClaim,
      maxMembers,
    };
    this.state.pools.set(id, pool);
    this.state.poolsByRegion.set(region, id);
    this.state.nextPoolId++;
    return { ok: true, value: id };
  }

  getPool(id: number): Pool | null {
    return this.state.pools.get(id) || null;
  }

  joinPool(poolId: number, contribution: number): Result<boolean> {
    const pool = this.state.pools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!pool.status) return { ok: false, value: ERR_POOL_CLOSED };
    if (contribution < pool.minContrib) return { ok: false, value: ERR_INVALID_CONTRIB_AMOUNT };
    const memberKey = `${poolId}-${this.caller}`;
    if (this.state.members.has(memberKey)) return { ok: false, value: ERR_ALREADY_MEMBER };
    if (pool.activeMembers >= pool.maxMembers) return { ok: false, value: ERR_MAX_MEMBERS_EXCEEDED };

    this.stxTransfers.push({ amount: contribution, from: this.caller, to: null });

    this.state.members.set(memberKey, { balance: contribution, joinedAt: this.blockHeight, hasClaimed: false });
    pool.totalBalance += contribution;
    pool.activeMembers += 1;
    return { ok: true, value: true };
  }

  submitClaim(poolId: number, amount: number, oracleData: number): Result<boolean> {
    const pool = this.state.pools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!pool.status) return { ok: false, value: ERR_POOL_CLOSED };
    const memberKey = `${poolId}-${this.caller}`;
    const member = this.state.members.get(memberKey);
    if (!member) return { ok: false, value: ERR_NOT_MEMBER };
    if (member.hasClaimed) return { ok: false, value: ERR_CLAIM_ALREADY_SUBMITTED };
    if (amount <= 0 || amount > pool.maxClaim) return { ok: false, value: ERR_INVALID_CLAIM_AMOUNT };
    if (oracleData <= 0) return { ok: false, value: ERR_INVALID_ORACLE_DATA };

    const claimKey = `${poolId}-${this.caller}`;
    this.state.claims.set(claimKey, { amount, submittedAt: this.blockHeight, status: "PENDING", votesFor: 0, votesAgainst: 0 });
    member.hasClaimed = true;
    return { ok: true, value: true };
  }

  voteOnClaim(poolId: number, claimant: string, vote: boolean): Result<boolean> {
    const pool = this.state.pools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (!pool.status) return { ok: false, value: ERR_POOL_CLOSED };
    const memberKey = `${poolId}-${this.caller}`;
    if (!this.state.members.has(memberKey)) return { ok: false, value: ERR_NOT_MEMBER };
    const claimKey = `${poolId}-${claimant}`;
    const claim = this.state.claims.get(claimKey);
    if (!claim) return { ok: false, value: ERR_CLAIM_ALREADY_SUBMITTED };
    if (this.caller === claimant) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (claim.status !== "PENDING") return { ok: false, value: ERR_VOTING_NOT_ALLOWED };

    if (vote) {
      claim.votesFor += 1;
    } else {
      claim.votesAgainst += 1;
    }
    return { ok: true, value: true };
  }

  processClaim(poolId: number, claimant: string): Result<boolean> {
    const pool = this.state.pools.get(poolId);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (pool.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    const claimKey = `${poolId}-${claimant}`;
    const claim = this.state.claims.get(claimKey);
    if (!claim) return { ok: false, value: ERR_CLAIM_ALREADY_SUBMITTED };
    if (claim.status !== "PENDING") return { ok: false, value: ERR_INVALID_STATUS };

    const totalVotes = claim.votesFor + claim.votesAgainst;
    const approvalThreshold = Math.floor(pool.activeMembers / 2);
    if (claim.votesFor >= approvalThreshold) {
      if (pool.totalBalance < claim.amount) return { ok: false, value: ERR_INSUFFICIENT_POOL_BALANCE };
      this.stxTransfers.push({ amount: claim.amount, from: null, to: claimant });
      pool.totalBalance -= claim.amount;
      claim.status = "APPROVED";
      return { ok: true, value: true };
    } else {
      claim.status = "REJECTED";
      return { ok: true, value: false };
    }
  }

  updatePool(id: number, updateRiskType: string, updatePremiumRate: number, updateCoverageLimit: number): Result<boolean> {
    const pool = this.state.pools.get(id);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (pool.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (!["FLOOD", "DROUGHT", "STORM"].includes(updateRiskType)) return { ok: false, value: ERR_INVALID_RISK_TYPE };
    if (updatePremiumRate <= 0 || updatePremiumRate > 100) return { ok: false, value: ERR_INVALID_PREMIUM_RATE };
    if (updateCoverageLimit <= 0) return { ok: false, value: ERR_INVALID_COVERAGE_LIMIT };

    pool.riskType = updateRiskType;
    pool.premiumRate = updatePremiumRate;
    pool.coverageLimit = updateCoverageLimit;
    pool.timestamp = this.blockHeight;
    this.state.poolUpdates.set(id, {
      updateRiskType,
      updatePremiumRate,
      updateCoverageLimit,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  closePool(id: number): Result<boolean> {
    const pool = this.state.pools.get(id);
    if (!pool) return { ok: false, value: ERR_POOL_NOT_FOUND };
    if (pool.creator !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    pool.status = false;
    return { ok: true, value: true };
  }

  getPoolCount(): Result<number> {
    return { ok: true, value: this.state.nextPoolId };
  }

  checkPoolExistence(region: string): Result<boolean> {
    return { ok: true, value: this.state.poolsByRegion.has(region) };
  }
}

describe("InsurancePool", () => {
  let contract: InsurancePoolMock;

  beforeEach(() => {
    contract = new InsurancePoolMock();
    contract.reset();
  });

  it("creates a pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const pool = contract.getPool(0);
    expect(pool?.riskType).toBe("FLOOD");
    expect(pool?.region).toBe("CoastalArea");
    expect(pool?.premiumRate).toBe(50);
    expect(pool?.coverageLimit).toBe(10000);
    expect(pool?.interestRate).toBe(10);
    expect(pool?.gracePeriod).toBe(7);
    expect(pool?.currency).toBe("STX");
    expect(pool?.minContrib).toBe(100);
    expect(pool?.maxClaim).toBe(5000);
    expect(pool?.maxMembers).toBe(200);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate pool regions", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.createPool(
      "DROUGHT",
      "CoastalArea",
      60,
      15000,
      15,
      14,
      "USD",
      200,
      10000,
      300
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_POOL_NOT_FOUND);
  });

  it("rejects pool creation without authority contract", () => {
    const result = contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid risk type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "INVALID",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_RISK_TYPE);
  });

  it("joins pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.joinPool(0, 150);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pool = contract.getPool(0);
    expect(pool?.totalBalance).toBe(150);
    expect(pool?.activeMembers).toBe(1);
    expect(contract.stxTransfers.length).toBe(2);
  });

  it("rejects join with insufficient contribution", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.joinPool(0, 50);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_CONTRIB_AMOUNT);
  });

  it("submits claim successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    contract.joinPool(0, 150);
    const result = contract.submitClaim(0, 1000, 12345);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("rejects claim submission by non-member", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.submitClaim(0, 1000, 12345);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_MEMBER);
  });

  it("votes on claim successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    contract.joinPool(0, 150);
    contract.submitClaim(0, 1000, 12345);
    contract.caller = "ST3TEST";
    contract.joinPool(0, 200);
    const result = contract.voteOnClaim(0, "ST1TEST", true);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
  });

  it("updates pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.updatePool(0, "DROUGHT", 60, 15000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pool = contract.getPool(0);
    expect(pool?.riskType).toBe("DROUGHT");
    expect(pool?.premiumRate).toBe(60);
    expect(pool?.coverageLimit).toBe(15000);
  });

  it("closes pool successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.closePool(0);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const pool = contract.getPool(0);
    expect(pool?.status).toBe(false);
  });

  it("returns correct pool count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    contract.createPool(
      "DROUGHT",
      "DryArea",
      60,
      15000,
      15,
      14,
      "USD",
      200,
      10000,
      300
    );
    const result = contract.getPoolCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks pool existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.checkPoolExistence("CoastalArea");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkPoolExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses pool parameters with Clarity types", () => {
    const riskType = stringAsciiCV("FLOOD");
    const premiumRate = uintCV(50);
    const coverageLimit = uintCV(10000);
    expect(riskType.value).toBe("FLOOD");
    expect(premiumRate.value).toEqual(BigInt(50));
    expect(coverageLimit.value).toEqual(BigInt(10000));
  });

  it("rejects pool creation with empty region", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createPool(
      "FLOOD",
      "",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_REGION);
  });

  it("rejects pool creation with max pools exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxPools = 1;
    contract.createPool(
      "FLOOD",
      "CoastalArea",
      50,
      10000,
      10,
      7,
      "STX",
      100,
      5000,
      200
    );
    const result = contract.createPool(
      "DROUGHT",
      "DryArea",
      60,
      15000,
      15,
      14,
      "USD",
      200,
      10000,
      300
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_POOLS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});
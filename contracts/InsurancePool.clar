(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-PREMIUM-RATE u101)
(define-constant ERR-INVALID-COVERAGE-LIMIT u102)
(define-constant ERR-INVALID-CONTRIB-AMOUNT u103)
(define-constant ERR-POOL-NOT-FOUND u104)
(define-constant ERR-ALREADY-MEMBER u105)
(define-constant ERR-NOT-MEMBER u106)
(define-constant ERR-INSUFFICIENT-POOL-BALANCE u107)
(define-constant ERR-INVALID-CLAIM-AMOUNT u108)
(define-constant ERR-CLAIM-ALREADY-SUBMITTED u109)
(define-constant ERR-INVALID-RISK-TYPE u110)
(define-constant ERR-INVALID-REGION u111)
(define-constant ERR-POOL-CLOSED u112)
(define-constant ERR-INVALID-ORACLE-DATA u113)
(define-constant ERR-VOTING-NOT-ALLOWED u114)
(define-constant ERR-INVALID-VOTE u115)
(define-constant ERR-INVALID-STATUS u116)
(define-constant ERR-MAX-MEMBERS-EXCEEDED u117)
(define-constant ERR-INVALID-TIMESTAMP u118)
(define-constant ERR-AUTHORITY-NOT-VERIFIED u119)
(define-constant ERR-INVALID-MIN-CONTRIB u120)
(define-constant ERR-INVALID-MAX-CLAIM u121)
(define-constant ERR-UPDATE-NOT-ALLOWED u122)
(define-constant ERR-INVALID-UPDATE-PARAM u123)
(define-constant ERR-MAX-POOLS-EXCEEDED u124)
(define-constant ERR-INVALID-INTEREST-RATE u125)
(define-constant ERR-INVALID-GRACE-PERIOD u126)
(define-constant ERR-INVALID-CURRENCY u127)

(define-data-var next-pool-id uint u0)
(define-data-var max-pools uint u1000)
(define-data-var creation-fee uint u1000)
(define-data-var authority-contract (optional principal) none)

(define-map pools
  uint
  {
    risk-type: (string-ascii 20),
    region: (string-ascii 50),
    premium-rate: uint,
    coverage-limit: uint,
    total-balance: uint,
    active-members: uint,
    status: bool,
    timestamp: uint,
    creator: principal,
    interest-rate: uint,
    grace-period: uint,
    currency: (string-ascii 20),
    min-contrib: uint,
    max-claim: uint,
    max-members: uint
  }
)

(define-map pools-by-region
  (string-ascii 50)
  uint)

(define-map members
  { pool-id: uint, member: principal }
  { balance: uint, joined-at: uint, has-claimed: bool }
)

(define-map claims
  { pool-id: uint, claimant: principal }
  { amount: uint, submitted-at: uint, status: (string-ascii 20), votes-for: uint, votes-against: uint }
)

(define-map pool-updates
  uint
  {
    update-risk-type: (string-ascii 20),
    update-premium-rate: uint,
    update-coverage-limit: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-read-only (get-pool (id uint))
  (map-get? pools id)
)

(define-read-only (get-pool-updates (id uint))
  (map-get? pool-updates id)
)

(define-read-only (get-member (pool-id uint) (member principal))
  (map-get? members { pool-id: pool-id, member: member })
)

(define-read-only (get-claim (pool-id uint) (claimant principal))
  (map-get? claims { pool-id: pool-id, claimant: claimant })
)

(define-read-only (is-pool-registered (region (string-ascii 50)))
  (is-some (map-get? pools-by-region region))
)

(define-private (validate-risk-type (risk (string-ascii 20)))
  (if (or (is-eq risk "FLOOD") (is-eq risk "DROUGHT") (is-eq risk "STORM"))
      (ok true)
      (err ERR-INVALID-RISK-TYPE))
)

(define-private (validate-region (reg (string-ascii 50)))
  (if (and (> (len reg) u0) (<= (len reg) u50))
      (ok true)
      (err ERR-INVALID-REGION))
)

(define-private (validate-premium-rate (rate uint))
  (if (and (> rate u0) (<= rate u100))
      (ok true)
      (err ERR-INVALID-PREMIUM-RATE))
)

(define-private (validate-coverage-limit (limit uint))
  (if (> limit u0)
      (ok true)
      (err ERR-INVALID-COVERAGE-LIMIT))
)

(define-private (validate-contrib-amount (amount uint) (min-contrib uint))
  (if (>= amount min-contrib)
      (ok true)
      (err ERR-INVALID-CONTRIB-AMOUNT))
)

(define-private (validate-claim-amount (amount uint) (max-claim uint))
  (if (and (> amount u0) (<= amount max-claim))
      (ok true)
      (err ERR-INVALID-CLAIM-AMOUNT))
)

(define-private (validate-interest-rate (rate uint))
  (if (<= rate u20)
      (ok true)
      (err ERR-INVALID-INTEREST-RATE))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-currency (cur (string-ascii 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-contrib (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-CONTRIB))
)

(define-private (validate-max-claim (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX-CLAIM))
)

(define-private (validate-max-members (members uint))
  (if (and (> members u0) (<= members u500))
      (ok true)
      (err ERR-MAX-MEMBERS-EXCEEDED))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-status (status bool))
  (ok true)
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-pools (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-MAX-POOLS-EXCEEDED))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-pools new-max)
    (ok true)
  )
)

(define-public (set-creation-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set creation-fee new-fee)
    (ok true)
  )
)

(define-public (create-pool
  (risk-type (string-ascii 20))
  (region (string-ascii 50))
  (premium-rate uint)
  (coverage-limit uint)
  (interest-rate uint)
  (grace-period uint)
  (currency (string-ascii 20))
  (min-contrib uint)
  (max-claim uint)
  (max-members uint)
)
  (let (
        (next-id (var-get next-pool-id))
        (current-max (var-get max-pools))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-POOLS-EXCEEDED))
    (try! (validate-risk-type risk-type))
    (try! (validate-region region))
    (try! (validate-premium-rate premium-rate))
    (try! (validate-coverage-limit coverage-limit))
    (try! (validate-interest-rate interest-rate))
    (try! (validate-grace-period grace-period))
    (try! (validate-currency currency))
    (try! (validate-min-contrib min-contrib))
    (try! (validate-max-claim max-claim))
    (try! (validate-max-members max-members))
    (asserts! (is-none (map-get? pools-by-region region)) (err ERR-POOL-NOT-FOUND))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get creation-fee) tx-sender authority-recipient))
    )
    (map-set pools next-id
      {
        risk-type: risk-type,
        region: region,
        premium-rate: premium-rate,
        coverage-limit: coverage-limit,
        total-balance: u0,
        active-members: u0,
        status: true,
        timestamp: block-height,
        creator: tx-sender,
        interest-rate: interest-rate,
        grace-period: grace-period,
        currency: currency,
        min-contrib: min-contrib,
        max-claim: max-claim,
        max-members: max-members
      }
    )
    (map-set pools-by-region region next-id)
    (var-set next-pool-id (+ next-id u1))
    (print { event: "pool-created", id: next-id })
    (ok next-id)
  )
)

(define-public (join-pool (pool-id uint) (contribution uint))
  (let ((pool (unwrap! (map-get? pools pool-id) (err ERR-POOL-NOT-FOUND))))
    (asserts! (get status pool) (err ERR-POOL-CLOSED))
    (try! (validate-contrib-amount contribution (get min-contrib pool)))
    (asserts! (is-none (map-get? members { pool-id: pool-id, member: tx-sender })) (err ERR-ALREADY-MEMBER))
    (asserts! (< (get active-members pool) (get max-members pool)) (err ERR-MAX-MEMBERS-EXCEEDED))
    (try! (stx-transfer? contribution tx-sender (as-contract tx-sender)))
    (map-set members { pool-id: pool-id, member: tx-sender }
      { balance: contribution, joined-at: block-height, has-claimed: false }
    )
    (map-set pools pool-id
      (merge pool { total-balance: (+ (get total-balance pool) contribution), active-members: (+ (get active-members pool) u1) })
    )
    (print { event: "member-joined", pool-id: pool-id, member: tx-sender })
    (ok true)
  )
)

(define-public (submit-claim (pool-id uint) (amount uint) (oracle-data uint))
  (let ((pool (unwrap! (map-get? pools pool-id) (err ERR-POOL-NOT-FOUND)))
        (member (unwrap! (map-get? members { pool-id: pool-id, member: tx-sender }) (err ERR-NOT-MEMBER))))
    (asserts! (get status pool) (err ERR-POOL-CLOSED))
    (asserts! (not (get has-claimed member)) (err ERR-CLAIM-ALREADY-SUBMITTED))
    (try! (validate-claim-amount amount (get max-claim pool)))
    (asserts! (> oracle-data u0) (err ERR-INVALID-ORACLE-DATA))
    (map-set claims { pool-id: pool-id, claimant: tx-sender }
      { amount: amount, submitted-at: block-height, status: "PENDING", votes-for: u0, votes-against: u0 }
    )
    (map-set members { pool-id: pool-id, member: tx-sender }
      (merge member { has-claimed: true })
    )
    (print { event: "claim-submitted", pool-id: pool-id, claimant: tx-sender })
    (ok true)
  )
)

(define-public (vote-on-claim (pool-id uint) (claimant principal) (vote bool))
  (let ((pool (unwrap! (map-get? pools pool-id) (err ERR-POOL-NOT-FOUND)))
        (member (unwrap! (map-get? members { pool-id: pool-id, member: tx-sender }) (err ERR-NOT-MEMBER)))
        (claim (unwrap! (map-get? claims { pool-id: pool-id, claimant: claimant }) (err ERR-CLAIM-ALREADY-SUBMITTED))))
    (asserts! (get status pool) (err ERR-POOL-CLOSED))
    (asserts! (not (is-eq tx-sender claimant)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status claim) "PENDING") (err ERR-VOTING-NOT-ALLOWED))
    (let ((new-votes-for (if vote (+ (get votes-for claim) u1) (get votes-for claim)))
          (new-votes-against (if vote (get votes-against claim) (+ (get votes-against claim) u1))))
      (map-set claims { pool-id: pool-id, claimant: claimant }
        (merge claim { votes-for: new-votes-for, votes-against: new-votes-against })
      )
    )
    (print { event: "vote-cast", pool-id: pool-id, claimant: claimant, vote: vote })
    (ok true)
  )
)

(define-public (process-claim (pool-id uint) (claimant principal))
  (let ((pool (unwrap! (map-get? pools pool-id) (err ERR-POOL-NOT-FOUND)))
        (claim (unwrap! (map-get? claims { pool-id: pool-id, claimant: claimant }) (err ERR-CLAIM-ALREADY-SUBMITTED))))
    (asserts! (is-eq tx-sender (get creator pool)) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status claim) "PENDING") (err ERR-INVALID-STATUS))
    (let ((total-votes (+ (get votes-for claim) (get votes-against claim)))
          (approval-threshold (/ (get active-members pool) u2)))
      (if (>= (get votes-for claim) approval-threshold)
          (begin
            (asserts! (>= (get total-balance pool) (get amount claim)) (err ERR-INSUFFICIENT-POOL-BALANCE))
            (as-contract (try! (stx-transfer? (get amount claim) tx-sender claimant)))
            (map-set pools pool-id
              (merge pool { total-balance: (- (get total-balance pool) (get amount claim)) })
            )
            (map-set claims { pool-id: pool-id, claimant: claimant }
              (merge claim { status: "APPROVED" })
            )
            (print { event: "claim-approved", pool-id: pool-id, claimant: claimant })
            (ok true)
          )
          (begin
            (map-set claims { pool-id: pool-id, claimant: claimant }
              (merge claim { status: "REJECTED" })
            )
            (print { event: "claim-rejected", pool-id: pool-id, claimant: claimant })
            (ok false)
          )
      )
    )
  )
)

(define-public (update-pool
  (pool-id uint)
  (update-risk-type (string-ascii 20))
  (update-premium-rate uint)
  (update-coverage-limit uint)
)
  (let ((pool (map-get? pools pool-id)))
    (match pool
      p
        (begin
          (asserts! (is-eq (get creator p) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-risk-type update-risk-type))
          (try! (validate-premium-rate update-premium-rate))
          (try! (validate-coverage-limit update-coverage-limit))
          (map-set pools pool-id
            (merge p {
              risk-type: update-risk-type,
              premium-rate: update-premium-rate,
              coverage-limit: update-coverage-limit,
              timestamp: block-height
            })
          )
          (map-set pool-updates pool-id
            {
              update-risk-type: update-risk-type,
              update-premium-rate: update-premium-rate,
              update-coverage-limit: update-coverage-limit,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "pool-updated", id: pool-id })
          (ok true)
        )
      (err ERR-POOL-NOT-FOUND)
    )
  )
)

(define-public (close-pool (pool-id uint))
  (let ((pool (unwrap! (map-get? pools pool-id) (err ERR-POOL-NOT-FOUND))))
    (asserts! (is-eq (get creator pool) tx-sender) (err ERR-NOT-AUTHORIZED))
    (map-set pools pool-id
      (merge pool { status: false })
    )
    (print { event: "pool-closed", id: pool-id })
    (ok true)
  )
)

(define-public (get-pool-count)
  (ok (var-get next-pool-id))
)

(define-public (check-pool-existence (region (string-ascii 50)))
  (ok (is-pool-registered region))
)
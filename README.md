# Descrizione della DApp

Questa DApp è composta da tre contratti intelligenti: `Token`, `Presale`, e `Staking`.

## Token

Il contratto `Token` definisce un token ERC20 standard con funzionalità di minting e burning.

-   **Costruttore**:
    -   `name`: Nome del token.
    -   `symbol`: Simbolo del token.
    -   `initialSupply`: Fornitura iniziale del token. Viene coniata al creatore del contratto.
-   **Funzioni**:
    -   `mint(address to, uint256 amount)`: Conia nuovi token e li assegna all'indirizzo specificato. Può essere chiamata solo dal proprietario del contratto.
    -   `burn(uint256 amount)`: Brucia una quantità specificata di token dal saldo del chiamante.

## Presale

Il contratto `Presale` gestisce la prevendita del token ERC20 definito nel contratto `Token`.

-   **Costruttore**:
    -   `_token`: Indirizzo del contratto del token.
    -   `_uniswapRouter`: Indirizzo del router Uniswap V2.
    -   `_softCap`: Soft cap della prevendita in ETH.
    -   `_hardCap`: Hard cap della prevendita in ETH.
    -   `_minContribution`: Contributo minimo in ETH.
    -   `_maxContribution`: Contributo massimo in ETH.
    -   `_presalePrice`: Prezzo di prevendita del token (numero di token per 1 ETH).
-   **Variabili di stato**:
    -   `token`: Istanza del contratto del token.
    -   `uniswapRouter`: Istanza del router Uniswap V2.
    -   `softCap`: Soft cap della prevendita.
    -   `hardCap`: Hard cap della prevendita.
    -   `minContribution`: Contributo minimo.
    -   `maxContribution`: Contributo massimo.
    -   `presalePrice`: Prezzo di prevendita.
    -   `totalRaised`: Quantità totale di ETH raccolta durante la prevendita.
    -   `contributions`: Mapping degli indirizzi dei contributori ai loro contributi in ETH.
    -   `presaleFinalized`: Indica se la prevendita è stata finalizzata.
    -   `liquidityAdded`: Indica se la liquidità è stata aggiunta a Uniswap.
-   **Eventi**:
    -   `TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount)`: Emetto quando un utente acquista token durante la prevendita.
    -   `PresaleFinalized(uint256 totalRaised)`: Emetto quando la prevendita viene finalizzata.
    -   `LiquidityAdded(uint256 ethAmount, uint256 tokenAmount)`: Emetto quando la liquidità viene aggiunta a Uniswap.
-   **Funzioni**:
    -   `participate() external payable nonReentrant`: Consente agli utenti di partecipare alla prevendita inviando ETH. I token vengono trasferiti immediatamente all'acquirente.
    -   `finalize() external onlyOwner`: Finalizza la prevendita. Può essere chiamata solo dal proprietario dopo che la prevendita è terminata e il soft cap è stato raggiunto. Aggiunge liquidità a Uniswap e trasferisce i token e l'ETH rimanenti al proprietario.
    -   `refund() external nonReentrant`: Consente agli utenti di richiedere un rimborso se la prevendita è terminata e il soft cap non è stato raggiunto.
    -   `receive() external payable`: Funzione di fallback per ricevere ETH.

## Staking

Il contratto `Staking` consente agli utenti di mettere in stake il token ERC20 definito nel contratto `Token` e di guadagnare ricompense.

-   **Costruttore**:
    -   `_stakingToken`: Indirizzo del contratto del token di staking.
    -   `_rewardRate`: Tasso di ricompensa (ricompense al secondo per token).
    -   `_minimumStakingPeriod`: Periodo minimo di staking (in secondi).
-   **Variabili di stato**:
    -   `stakingToken`: Istanza del contratto del token di staking.
    -   `rewardRate`: Tasso di ricompensa.
    -   `minimumStakingPeriod`: Periodo minimo di staking.
    -   `totalStaked`: Quantità totale di token in stake.
    -   `stakes`: Mapping degli indirizzi degli staker alle loro informazioni di staking.
-   **Strutture**:
    -   `StakeInfo`:
        -   `amount`: Quantità di token in stake.
        -   `startTime`: Timestamp di inizio dello staking.
        -   `lastClaimTime`: Timestamp dell'ultima richiesta di ricompense.
        -   `unclaimableRewards`: Ricompense non reclamabili accumulate.
-   **Eventi**:
    -   `Staked(address indexed user, uint256 amount)`: Emetto quando un utente mette in stake i token.
    -   `Withdrawn(address indexed user, uint256 amount)`: Emetto quando un utente ritira i token.
    -   `RewardsClaimed(address indexed user, uint256 reward)`: Emetto quando un utente richiede le ricompense.
-   **Funzioni**:
    -   `stake(uint256 _amount) external nonReentrant`: Mette in stake una quantità specificata di token.
    -   `withdraw(uint256 _amount) external nonReentrant`: Ritira una quantità specificata di token.
    -   `claimRewards() external nonReentrant`: Richiede le ricompense maturate.
    -   `calculateRewards(address _staker) public view returns (uint256)`: Calcola le ricompense maturate da un utente.
    -   `updateRewardRate(uint256 _newRate) external onlyOwner`: Aggiorna il tasso di ricompensa. Può essere chiamata solo dal proprietario del contratto.
    -   `updateMinimumStakingPeriod(uint256 _newPeriod) external onlyOwner`: Aggiorna il periodo minimo di staking. Può essere chiamata solo dal proprietario del contratto.
    -   `getStakeInfo(address _staker) external view returns (uint256 amount, uint256 startTime, uint256 pendingRewards)`: Restituisce le informazioni sullo stake di un utente.

## Diversificazione del Total Supply

Il total supply del token è gestito dal contratto `Token`. Inizialmente, l'intero supply viene assegnato al creatore del contratto. Il proprietario del contratto può coniare nuovi token usando la funzione `mint`, aumentando il total supply. Gli utenti possono bruciare i propri token usando la funzione `burn`, diminuendo il total supply.

Durante la prevendita, i token vengono trasferiti agli acquirenti in base all'ETH inviato e al prezzo di prevendita. Questo non modifica il total supply, ma ridistribuisce i token esistenti.

Quando la prevendita viene finalizzata, una parte dei token raccolti viene utilizzata per aggiungere liquidità a Uniswap insieme a una parte dell'ETH raccolto. I token rimanenti e l'ETH vengono trasferiti al proprietario del contratto. Anche in questo caso, il total supply non viene modificato, ma la distribuzione dei token cambia.

Nello staking, gli utenti bloccano i propri token nel contratto `Staking` per guadagnare ricompense. Questo non modifica il total supply, ma riduce temporaneamente la quantità di token in circolazione. Quando gli utenti ritirano i propri token, questi tornano in circolazione. Le ricompense vengono coniate dal contratto `Staking` e assegnate agli utenti, aumentando il total supply.

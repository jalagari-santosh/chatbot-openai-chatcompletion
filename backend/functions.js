export  async function getGender(name) {
    try {
        const apiUrl = `https://api.genderize.io/?name=${name}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`Error: ${response.statusText}`);
        }
        const data = await response.json();
        return data.gender || Math.random() > 0.5 ? 'male' : 'female'
    } catch (error) {
        console.error("Error fetching gender:", error);
        return Math.random() > 0.5 ? 'male' : 'female';
    }
}
export async function getStockPrice(symbol) {
    try {
        const apiUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${symbol}&apikey=FDRET0CQ6QRWPRKW`;
        console.log('apiUrl', apiUrl)
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} - ${response.statusText}`);
        }
        
        const data = await response.json();
        console.log("response from getStockPriceMethod", JSON.stringify(data))
        
        if (data['Time Series (Daily)']) {
            const latestDate = Object.keys(data['Time Series (Daily)'])[0];
            return data['Time Series (Daily)'][latestDate]['4. close'];
        } else if (data['Note']) {
            // Handles API rate limiting
            throw new Error("API limit reached: " + data['Note']);
        } else if (data['Error Message']) {
            // Handles invalid symbols
            throw new Error("Invalid symbol: " + data['Error Message']);
        } else {
            throw new Error("Unexpected API response format.");
        }
    } catch (error) {
        console.error("Error fetching stock price:", error.message);
        return "Unable to get the stock price at this moment, please try again later.";
    }
}



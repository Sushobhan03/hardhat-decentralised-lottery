const { ethers } = require("hardhat")

async function enterLottery() {
    lottery = await ethers.getContract("Lottery")
    entranceFee = await lottery.getEntranceFee()
    await lottery.enterLottery({ value: entranceFee })
    console.log("Entered the lottery!!")
}

enterLottery()
    .then(() => process.exit(0))
    .catch((error) => {
        console.log(error)
        process.exit(1)
    })

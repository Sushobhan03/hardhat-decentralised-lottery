const { assert, expect } = require("chai")
const { network, ethers, getNamedAccounts } = require("hardhat")
const { networkConfig } = require("../../helper-hardhat-config")

const chainId = network.config.chainId

chainId != 31337
    ? describe.skip
    : describe("Lottery Unit Tests", function () {
          let lottery, vrfCoordinatorV2Mock, entranceFee, deployer, interval

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer //deployer = account[0]
              await deployments.fixture("all") // Deploys modules with the given tag
              lottery = await ethers.getContract("Lottery", deployer) // Returns a new connection to the Lottery contract
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer) //Returns a new connection to the VRFCoordinatorv2Mock contract
              entranceFee = await lottery.getEntranceFee()
              interval = await lottery.getInterval()
          })

          describe("constructor", function () {
              it("initializes the lottery correctly", async function () {
                  const lotteryState = await lottery.getCurrentState()
                  assert.equal(lotteryState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("enterLottery", function () {
              //Reverts when enough ETH is not sent or the lottery is not in the OPEN state
              it("reverts if enough ETH is not sent", async function () {
                  await expect(lottery.enterLottery()).to.be.revertedWith(
                      "Lottery__NotEnoughETHSent"
                  )
              })

              it("maintains a record of the player that enters the lottery", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  const firstPlayer = await lottery.getPlayer(0)
                  assert.equal(firstPlayer, deployer)
              })

              it("emits an event as soon as a player enters the lottery", async function () {
                  await expect(lottery.enterLottery({ value: entranceFee })).to.emit(
                      lottery,
                      "LotteryEnter"
                  )
              })

              it("reverts if the lottery is not in an OPEN state", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  //Following commands manipulate the blockchain's current state
                  //These can be used to take the blockchain forwards or backwards in time
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  //The keepers job is carried out by us
                  await lottery.performUpkeep([]) // The lottery state switches to CALCULATING
                  await expect(lottery.enterLottery({ value: entranceFee })).to.be.revertedWith(
                      "Lottery__LotteryNotOpen"
                  )
              })
          })

          describe("checkUpkeep", function () {
              it("returns false if no player has sent any ETH to the lottery", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("returns false if the lottery is not in an OPEN state", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await lottery.performUpkeep([])
                  const raffleState = await lottery.getCurrentState()
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
                  assert(raffleState.toString(), "1")
              })

              it("retuns false if required time has not passed", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 1]) // use a higher number if the test fails
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert(!upkeepNeeded)
              })

              it("returns true if lottery is OPEN, required time has passed, both a player and balance exist", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([])
                  assert.equal(upkeepNeeded, true)
              })
          })
          describe("performUpkeep", function () {
              it("can only run if checkUpkeep returns true", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  const tx = await lottery.performUpkeep([])
                  assert(tx)
              })

              it("reverts if checkUpkeep returns false", async function () {
                  await expect(lottery.performUpkeep([])).to.be.revertedWith(
                      `Lottery__UpkeepNotNeeded`
                  )
              })

              it("updates the raffle state", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  await lottery.performUpkeep([])
                  const lotteryState = await lottery.getCurrentState()
                  assert.equal(lotteryState.toString(), "1")
              })

              it("calls the vrfCoordinator as well as emits an event", async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  txResponse = await lottery.performUpkeep([]) // emits requestId
                  txReceipt = await txResponse.wait(1)
                  const requestId = txReceipt.events[1].args.requestId
                  assert(requestId.toString() > "0")
              })
          })

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await lottery.enterLottery({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
              })

              it("can only be called if performUpkeep is called", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
                  ).to.be.revertedWith("nonexistent request")
                  //This error message has been picked from the vrfCoordinatorv2Mock contract
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
                  ).to.be.revertedWith("nonexistent request")
              })

              /*The following test simulates players entering the lottery and wraps the entire functionality of the lottery into a promise that will resolve if everything happens to be true.
              An event listener for the event 'WinnerPicked' is set up.
              Mocks of Chainlink Keepers and VRF Coordinator are used to kick off this WinnerPicked event.
              All the assertions are done once the 'WinnerPicked' event is fired*/

              it("picks a winner, resets the lottery, and sends the money", async function () {
                  const additionalAccounts = 3
                  const startingAccountIndex = 1
                  const accounts = await ethers.getSigners()
                  for (
                      i = startingAccountIndex;
                      i < startingAccountIndex + additionalAccounts;
                      i++
                  ) {
                      const lotteryConnectedAccount = lottery.connect(accounts[i]) //Returns a new instance of the contract with every single account
                      await lotteryConnectedAccount.enterLottery({ value: entranceFee })
                  }

                  const startingTimestamp = await lottery.getLastTimeStamp()

                  await new Promise(async (resolve, reject) => {
                      lottery.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log(`Found the event!!`)
                          try {
                              const recentWinner = await lottery.getRecentWinner()
                              const currentTimestamp = await lottery.getLastTimeStamp()
                              const currentState = await lottery.getCurrentState()
                              const currentNumPlayers = await lottery.getNumOfPlayers()
                              const winnerEndingBalance = await accounts[1].getBalance()
                              assert.equal(currentNumPlayers.toString(), "0")
                              assert.equal(currentState.toString(), "0")
                              assert(currentTimestamp > startingTimestamp)
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance
                                      .add(entranceFee.mul(additionalAccounts))
                                      .add(entranceFee)
                                      .toString()
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })
                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      txResponse = await lottery.performUpkeep([])
                      txReceipt = await txResponse.wait(1)
                      const winnerStartingBalance = await accounts[1].getBalance()
                      const requestId = txReceipt.events[1].args.requestId
                      await vrfCoordinatorV2Mock.fulfillRandomWords(requestId, lottery.address)
                  })
              })
          })
      })

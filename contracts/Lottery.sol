//SPDX-License-Identifier: MIT

pragma solidity ^0.8.8;

//imports
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";

//Errors
error Lottery__NotEnoughETHSent();
error Lottery__TransferFailed();
error Lottery__LotteryNotOpen();
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 lotteryState);

/// @title A decentralized lottery system.
/// @author Sushobhan Pathare
/// @notice This smart contract creates a decentralized, untamperable lottery system for any number of participants.
/// @dev This contract implements Chainlink VRF v2 and Chainlink Keepers
contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    /* Type declarations */
    enum LotteryState {
        OPEN,
        CALCULATING
    }
    /* State Variables */
    uint256 private immutable i_entranceFee;
    address payable[] private s_players;

    /* Chainlink VRF variables */
    VRFCoordinatorV2Interface private immutable i_vrfCoordinator;
    bytes32 private immutable i_gasLane;
    uint64 private immutable i_subId;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private immutable i_callbackGasLimit;
    uint32 private constant NUM_WORDS = 1;

    /* Lottery Variables */
    address private s_recentWinner;
    LotteryState private s_lotteryState;
    uint256 private s_lastTimeStamp;
    uint256 private immutable i_interval;

    /*Events*/
    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    /*Functions*/
    constructor(
        address vrfCoordinatorV2,
        uint256 entranceFee,
        bytes32 gasLane,
        uint64 subId,
        uint32 callbackGasLimit,
        uint256 interval
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        i_entranceFee = entranceFee;
        i_vrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        i_gasLane = gasLane; //keyhash
        i_subId = subId;
        i_callbackGasLimit = callbackGasLimit;
        s_lotteryState = LotteryState.OPEN;
        s_lastTimeStamp = block.timestamp;
        i_interval = interval;
    }

    function enterLottery() public payable {
        if (msg.value < i_entranceFee) {
            revert Lottery__NotEnoughETHSent();
        }
        if (s_lotteryState != LotteryState.OPEN) {
            revert Lottery__LotteryNotOpen();
        }
        s_players.push(payable(msg.sender));
        //Emits an event when player is added to the array
        emit LotteryEnter(msg.sender);
    }

    /// @dev This is the function that the chainlink Keeper nodes call
    /// They check if the 'UpKeepNeeded' returns ture
    /// Things which determine 'upKeepNeeded' to be true:
    ///1. Time interval needs to be passed
    ///2. There needs to be atleast 1 player inside the lottery and also contain some ETH
    ///3. Our subscription needs to be funded with ETH
    ///4. The lottery needs to be in an open state

    function checkUpkeep(
        bytes memory /*checkData*/
    ) public override returns (bool upkeepNeeded, bytes memory /* performData */) {
        bool isOpen = (s_lotteryState == LotteryState.OPEN);
        bool timePassed = ((block.timestamp - s_lastTimeStamp) > i_interval);
        bool hasPlayers = (s_players.length > 0);
        bool hasBalance = (address(this).balance > 0);
        upkeepNeeded = (isOpen && timePassed && hasPlayers && hasBalance);
    }

    /// @dev Once 'checkUpkeep' returns 'true', this function is called and it kicks off a Chainlink VRF call to get a random winner

    function performUpkeep(bytes calldata /* performData */) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if (!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(
                address(this).balance,
                s_players.length,
                uint256(s_lotteryState)
            );
        }

        s_lotteryState = LotteryState.CALCULATING;
        uint256 requestId = i_vrfCoordinator.requestRandomWords(
            i_gasLane,
            i_subId,
            REQUEST_CONFIRMATIONS,
            i_callbackGasLimit,
            NUM_WORDS
        );

        emit RequestedLotteryWinner(requestId);
        //The above event is redundant as 'requestRandomWords' already triggers an event when a request is submitted
    }

    /// @dev This is the function that Chainlink VRF nodes call to send the money to the randomly chosen winner

    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % s_players.length;
        address payable recentWinner = s_players[indexOfWinner];
        s_recentWinner = recentWinner;
        s_lotteryState = LotteryState.OPEN;
        s_players = new address payable[](0);
        s_lastTimeStamp = block.timestamp;
        (bool isSuccess, ) = recentWinner.call{value: address(this).balance}("");
        if (!isSuccess) {
            revert Lottery__TransferFailed();
        }
        emit WinnerPicked(recentWinner);
    }

    /*View/Pure functions */
    function getEntranceFee() public view returns (uint256) {
        return i_entranceFee;
    }

    function getPlayer(uint256 index) public view returns (address) {
        return s_players[index];
    }

    function getGasLane() public view returns (bytes32) {
        return i_gasLane;
    }

    function getSubId() public view returns (uint64) {
        return i_subId;
    }

    function getRequestConfirmations() public pure returns (uint16) {
        return REQUEST_CONFIRMATIONS;
    }

    function getCallbackGasLimit() public view returns (uint32) {
        return i_callbackGasLimit;
    }

    function getNumWords() public pure returns (uint32) {
        return NUM_WORDS;
    }

    function getRecentWinner() public view returns (address) {
        return s_recentWinner;
    }

    function getCurrentState() public view returns (LotteryState) {
        return s_lotteryState;
    }

    function getLastTimeStamp() public view returns (uint256) {
        return s_lastTimeStamp;
    }

    function getNumOfPlayers() public view returns (uint256) {
        return s_players.length;
    }

    function getInterval() public view returns (uint256) {
        return i_interval;
    }
}

// Khởi tạo trạng thái dữ liệu trò chơi
let questionsData = [];
let teams = [
    { id: 1, name: "Nhóm 1", score: 10 },
    { id: 2, name: "Nhóm 2", score: 10 },
    { id: 3, name: "Nhóm 3", score: 10 },
    { id: 4, name: "Nhóm 4", score: 10 },
    { id: 5, name: "Nhóm 6", score: 10 }
];

let currentTeamIndex = 0; // Nhóm 1 xuất phát trước (index = 0)
let currentSelectedCell = null;
let currentQuestion = null;

// Biến quản lý bộ đếm thời gian
let mainTimerInterval = null;
let reboundTimerInterval = null;
let mainTimeLeft = 15;
let reboundTimeLeft = 10;
let currentReboundTeamIndex = 0; // Index của nhóm cướp hiện tại
let reboundTeamAnswerTimes = [5, 4, 3, 3]; // Thời gian trả lời cho từng nhóm cướp

// Trạng thái trong lượt câu hỏi hiện tại
let currentBetAmount = 10; // Mặc định cho câu hỏi đặt cược
let currentStealTargetTeamId = null; // Đội bị nhắm cướp điểm
let hasAnswered = false;
let excludedTeamsForRebound = []; // Các đội đã trả lời sai câu này (gồm đội chính + đội cướp xịt)
let currentReboundTeamId = null; // Nhóm đang được cướp quyền

// Chạy ngay khi tải xong trang web
document.addEventListener("DOMContentLoaded", () => {
    loadQuestions();
    renderScoreboard();
    generateGridBoard();
});

// 1. TẢI FILE JSON CÂU HỎI
async function loadQuestions() {
    try {
        const response = await fetch('data.json');
        questionsData = await response.json();
    } catch (error) {
        console.error("Lỗi tải tệp data.json, sử dụng dữ liệu mặc định.", error);
    }
}

// 2. TẠO BẢNG ĐIỂM LIÊN TỤC Ở SIDEBAR
function renderScoreboard() {
    const scoreboardDiv = document.getElementById("scoreboard");
    scoreboardDiv.innerHTML = "";
    
    // Sắp xếp bản sao để xem thứ hạng nhưng vẫn giữ nguyên thứ tự hiển thị cố định từ Nhóm 1 - Nhóm 5
    const sortedTeams = [...teams].sort((a,b) => b.score - a.score);

    teams.forEach(team => {
        const card = document.createElement("div");
        card.className = "team-score-card";
        
        // Thêm class highlight nếu đến lượt nhóm đó chọn ô
        if (teams[currentTeamIndex].id === team.id) {
            card.classList.add("active-turn");
        }

        // Gắn huy hiệu top hạng màu sắc dựa trên điểm số hiện tại
        if (team.id === sortedTeams[0].id) card.classList.add("rank-1");
        else if (team.id === sortedTeams[1].id) card.classList.add("rank-2");
        else if (team.id === sortedTeams[2].id) card.classList.add("rank-3");

        card.innerHTML = `
            <div class="team-name">${team.name}</div>
            <div class="team-score">${team.score}đ</div>
            <div class="clear"></div>
        `;
        scoreboardDiv.appendChild(card);
    });

    // Cập nhật text hiển thị lượt
    document.getElementById("current-team-display").innerText = teams[currentTeamIndex].name;
}

// 3. TẠO 30 Ô CHỮ TRÊN BÀN CỜ LẬT
function generateGridBoard() {
    const board = document.getElementById("grid-board");
    board.innerHTML = "";
    for (let i = 1; i <= 30; i++) {
        const cell = document.createElement("div");
        cell.className = "grid-cell";
        cell.id = `cell-${i}`;
        cell.innerText = i;
        cell.onclick = () => handleCellClick(i);
        board.appendChild(cell);
    }
}

// 4. XỬ LÝ KHI QUẢN TRÒ BẤM CHỌN MỞ Ô
function handleCellClick(cellNumber) {
    currentSelectedCell = cellNumber;
    
    // Lấy câu hỏi tương ứng trong mảng dữ liệu (vòng lặp tuần hoàn nếu mảng ít hơn 30)
    currentQuestion = questionsData[(cellNumber - 1) % questionsData.length];
    
    // Reset cấu hình trạng thái câu hỏi mới
    hasAnswered = false;
    excludedTeamsForRebound = [teams[currentTeamIndex].id]; // Đội chính mặc định nằm trong danh sách đã dùng lượt

    // Kiểm tra loại ô để hiển thị Modal Đặc Quyền trước
    openPowerModal();
}

// HÀM TỐ TOÁN CÁC MỨC CƯỢC HỢP LỆ
function calculateValidBetAmounts(teamScore) {
    const amounts = [];
    for (let i = 10; i <= teamScore; i += 10) {
        amounts.push(i);
    }
    // Nếu điểm không phải bội của 10, thêm điểm hiện tại làm mức cược tối đa
    if (teamScore % 10 !== 0 && teamScore >= 10) {
        amounts.push(teamScore);
    }
    return amounts.sort((a, b) => a - b);
}

// 5. HIỂN THỊ MODAL QUYỀN ĐẶC BIỆT
function openPowerModal() {
    const modal = document.getElementById("power-modal");
    const title = document.getElementById("power-title");
    const icon = document.getElementById("power-icon");
    const desc = document.getElementById("power-desc");
    
    const betArea = document.getElementById("bet-input-area");
    const stealArea = document.getElementById("steal-input-area");
    
    betArea.classList.add("hidden");
    stealArea.classList.add("hidden");

    const currentTeamName = teams[currentTeamIndex].name;
    const currentTeamScore = teams[currentTeamIndex].score;

    switch(currentQuestion.type) {
        case "normal":
            title.innerText = "CÂU HỎI THƯỜNG";
            icon.innerText = "📝";
            desc.innerText = `Lượt lựa chọn của ${currentTeamName}. Trả lời đúng cộng 10 điểm, sai không bị trừ điểm nhưng các nhóm khác có quyền cướp.`;
            break;
        case "speedup":
            title.innerText = "CÂU TĂNG TỐC";
            icon.innerText = "⚡";
            desc.innerText = `Cơ hội bứt phá! Trả lời đúng cộng thẳng 20 điểm. Trả lời sai không trừ điểm. Các nhóm khác cướp đúng nhận 10 điểm.`;
            break;
        case "bet":
            // Kiểm tra nếu điểm < 10 thì skip câu hỏi
            if (currentTeamScore < 10) {
                title.innerText = "CÂU ĐẶT CƯỢC - BỎ QUA";
                icon.innerText = "🚫";
                desc.innerText = `${currentTeamName} có ${currentTeamScore} điểm (< 10 điểm). Điều kiện không đủ để cược, lượt này tự động bỏ qua. Ô sẽ được mở và chuyển sang đội khác!`;
                // Thêm flag để xử lý skip trong closePowerAndOpenQuestion
                currentQuestion.skipBet = true;
            } else {
                title.innerText = "CÂU ĐẶT CƯỢC";
                icon.innerText = "🎲";
                desc.innerText = `${currentTeamName} lật trúng ô Đặt cược! Hãy chọn mức điểm cược trước khi xem câu hỏi. Đúng cộng bằng số điểm cược, sai TRỪ tương ứng!`;
                
                // Tính toán và hiển thị các mức cược hợp lệ
                const validAmounts = calculateValidBetAmounts(currentTeamScore);
                const betSelect = document.getElementById("bet-amount");
                betSelect.innerHTML = "";
                validAmounts.forEach(amount => {
                    const opt = document.createElement("option");
                    opt.value = amount;
                    opt.innerText = `${amount} Điểm`;
                    betSelect.appendChild(opt);
                });
                
                betArea.classList.remove("hidden");
            }
            break;
        case "steal":
            title.innerText = "CÂU CƯỚP ĐIỂM";
            icon.innerText = "⚔️";
            desc.innerText = `Ô độc quyền kích hoạt! Trả lời đúng nhận 10 điểm và cướp 10 điểm của 1 đội khác (Tổng điểm nhận là 20 điểm). Trả lời sai ${currentTeamName} bị TRỪ 10 điểm!`;
            
            // Render danh sách các đội hợp lệ để cướp (điểm >= 10 và không phải chính mình)
            const targetSelect = document.getElementById("steal-target-team");
            targetSelect.innerHTML = "";
            let validTargets = teams.filter(t => t.id !== teams[currentTeamIndex].id && t.score >= 10);
            
            if(validTargets.length === 0) {
                const opt = document.createElement("option");
                opt.value = "none";
                opt.innerText = "Không có đội nào đủ điểm để cướp (Hệ thống tự phát điểm)";
                targetSelect.appendChild(opt);
            } else {
                validTargets.forEach(t => {
                    const opt = document.createElement("option");
                    opt.value = t.id;
                    opt.innerText = `${t.name} (Hiện có: ${t.score}đ)`;
                    targetSelect.appendChild(opt);
                });
            }
            stealArea.classList.remove("hidden");
            break;
        case "lucky":
            title.innerText = "HỘP QUÀ MAY MẮN";
            icon.innerText = "🎁";
            desc.innerText = `Tuyệt vời! ${currentTeamName} nhận được quà may mắn trực tiếp từ hệ thống, nhận ngay +15 điểm mà không cần thực hiện thử thách nào!`;
            break;
        case "mine":
            title.innerText = "CÂU DÍNH MÌN";
            icon.innerText = "💣";
            desc.innerText = `${currentTeamName} lật trúng ô Dính mìn! Nếu trả lời SAI sẽ bị TRỪ 10 điểm. Trả lời đúng thì không sao - không cộng điểm nhưng thoát chết!`;
            break;
    }

    modal.classList.add("active");
}

// 6. ĐÓNG MODAL ĐẶC QUYỀN VÀ MỞ BẢNG CÂU HỎI CHÍNH
function closePowerAndOpenQuestion() {
    // Lưu các thông số cấu hình do quản trò nhập chọn từ trước
    if (currentQuestion.type === "bet") {
        if (!currentQuestion.skipBet) {
            currentBetAmount = parseInt(document.getElementById("bet-amount").value);
        }
    }
    if (currentQuestion.type === "steal") {
        const val = document.getElementById("steal-target-team").value;
        currentStealTargetTeamId = val === "none" ? null : parseInt(val);
    }
    
    closeModal("power-modal");

    // Nếu là ô may mắn, cộng điểm luôn và không cần hiện câu hỏi trắc nghiệm phức tạp
    if (currentQuestion.type === "lucky") {
        teams[currentTeamIndex].score += 15;
        renderScoreboard();
        
        // Làm biến mất ô vừa chọn
        document.getElementById(`cell-${currentSelectedCell}`).classList.add("opened");
        
        // Chuyển lượt luôn sang nhóm tiếp theo
        nextTeamTurn();
        checkGameEnd();
        return;
    }

    // Nếu là ô cược điểm mà điểm không đủ, bỏ qua luôn
    if (currentQuestion.type === "bet" && currentQuestion.skipBet) {
        // Làm biến mất ô vừa chọn
        document.getElementById(`cell-${currentSelectedCell}`).classList.add("opened");
        
        // Chuyển lượt sang nhóm tiếp theo
        nextTeamTurn();
        checkGameEnd();
        return;
    }

    // Tiến hành mở cửa sổ câu hỏi trắc nghiệm chính thức
    openQuestionModal();
}

// 7. HIỂN THỊ CHI TIẾT CÂU HỎI VÀ KÍCH HOẠT ĐẾM NGƯỢC 17 GIÂY
function openQuestionModal() {
    const modal = document.getElementById("question-modal");
    document.getElementById("question-badge-type").innerText = currentQuestion.typeName;
    document.getElementById("question-text").innerText = currentQuestion.question;
    document.getElementById("action-after-answer").classList.add("hidden");

    const optionsGrid = document.getElementById("options-grid");
    optionsGrid.innerHTML = "";

    // Sinh 4 đáp án dạng nút bấm cho Quản trò thao tác click chọn hộ nhóm
    currentQuestion.options.forEach((optionText, index) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${optionText}`;
        btn.onclick = () => handleMainTeamAnswer(index);
        optionsGrid.appendChild(btn);
    });

    modal.classList.add("active");

    // Khởi động đồng hồ đếm ngược 15 giây của đội chính
    mainTimeLeft = 15;
    document.getElementById("main-timer").innerText = mainTimeLeft;
    document.getElementById("main-timer").classList.remove("bg-danger");
    
    clearInterval(mainTimerInterval);
    mainTimerInterval = setInterval(() => {
        mainTimeLeft--;
        document.getElementById("main-timer").innerText = mainTimeLeft;
        
        if (mainTimeLeft <= 5) {
            document.getElementById("main-timer").classList.add("bg-danger");
        }

        if (mainTimeLeft <= 0) {
            clearInterval(mainTimerInterval);
            handleMainTeamTimeout(); // Xử lý khi hết 15 giây
        }
    }, 1000);
}

// 8. XỬ LÝ KHI ĐỘI CHÍNH BẤM CHỌN ĐÁP ÁN
function handleMainTeamAnswer(selectedIndex) {
    if (hasAnswered) return; // Khóa không cho bấm lại liên tục
    hasAnswered = true;
    clearInterval(mainTimerInterval);

    const isCorrect = selectedIndex === currentQuestion.correct;
    const optionsButtons = document.getElementById("options-grid").getElementsByClassName("option-btn");
    
    // Nếu sai thì luôn highlight màu đáp án sai
    if (!isCorrect) {
        optionsButtons[selectedIndex].classList.add("wrong-choice");
    }

    // Chỉ show đáp án đúng nếu: Trả lời đúng HOẶC (Trả lời sai nhưng là câu không cho cướp quyền)
    const canSteal = (currentQuestion.type === "normal" || currentQuestion.type === "speedup");

    if (isCorrect || !canSteal) {
        optionsButtons[currentQuestion.correct].classList.add("correct-choice");
    }

    const currentTeam = teams[currentTeamIndex];
    const statusText = document.getElementById("result-status-text");
    document.getElementById("action-after-answer").classList.remove("hidden");

    if (isCorrect) {
        statusText.innerHTML = `<span style="color:#2b8a3e;">ĐÚNG CHÍNH XÁC!</span>`;
        // Tính toán phân bổ cộng điểm dựa theo luật từng loại ô chữ
        if (currentQuestion.type === "normal") {
            currentTeam.score += 10;
        } else if (currentQuestion.type === "speedup") {
            currentTeam.score += 20;
        } else if (currentQuestion.type === "bet") {
            currentTeam.score += currentBetAmount;
        } else if (currentQuestion.type === "steal") {
            currentTeam.score += 20; // Cướp đúng được 20 điểm (10 điểm thưởng + 10 điểm cướp)
            if (currentStealTargetTeamId) {
                const victim = teams.find(t => t.id === currentStealTargetTeamId);
                if (victim) victim.score -= 10; // Trừ điểm đội bị cướp
            }
        }
        // Câu dính mìn: trả lời đúng không cộng điểm, chỉ thoát chết
        renderScoreboard();
        
        // Khi trả lời đúng, luôn kết thúc câu hỏi, không cho cướp
        const nextBtn = document.getElementById("btn-next-turn");
        nextBtn.className = "btn btn-success";
        nextBtn.innerText = "HOÀN THÀNH LƯỢT CHƠI";
        nextBtn.onclick = () => finishQuestionTurn();
    } else {
        statusText.innerHTML = `<span style="color:#c92a2a;">SAI RỒI!</span>`;
        // Nếu sai ở câu đặt cược hoặc câu cướp điểm thì bị trừ điểm ngay lập tức
        if (currentQuestion.type === "bet") {
            currentTeam.score -= currentBetAmount;
            renderScoreboard();
        } else if (currentQuestion.type === "steal") {
            currentTeam.score -= 10;
            renderScoreboard();
        } else if (currentQuestion.type === "mine") {
            // Câu dính mìn: trả lời sai bị trừ 10 điểm
            currentTeam.score -= 10;
            renderScoreboard();
        }

        // Thay đổi nút hoàn thành thành nút kích hoạt cướp điểm cho các đội khác
        const nextBtn = document.getElementById("btn-next-turn");
        
        // Chỉ cho phép cướp quyền ở Câu Thường và Câu Tăng Tốc theo luật tối ưu của game
        if (currentQuestion.type === "normal" || currentQuestion.type === "speedup") {
            nextBtn.className = "btn btn-danger";
            nextBtn.innerText = "CÁC ĐỘI CÒN LẠI GIƠ TAY CƯỚP QUYỀN ⚔️";
            nextBtn.onclick = () => openReboundModal();
        } else {
            // Câu đặt cược, câu cướp điểm, và câu dính mìn sai thì kết thúc show đáp án luôn không cho cướp
            nextBtn.className = "btn btn-success";
            nextBtn.innerText = "HOÀN THÀNH LƯỢT CHƠI";
            nextBtn.onclick = () => finishQuestionTurn();
        }
    }
}

// 9. XỬ LÝ KHI ĐỘI CHÍNH HẾT GIỜ (TÍNH NHƯ TRẢ LỜI SAI)
function handleMainTeamTimeout() {
    hasAnswered = true;
    const currentTeam = teams[currentTeamIndex];
    const statusText = document.getElementById("result-status-text");
    document.getElementById("action-after-answer").classList.remove("hidden");
    
    // CHỈ highlight đáp án đúng cho câu đặt cược / cướp điểm
    // Với câu thường, tăng tốc, và dính mìn, KHÔNG hiển thị đáp án để các đội cướp còn bí
    const optionsButtons = document.getElementById("options-grid").getElementsByClassName("option-btn");
    if (currentQuestion.type !== "normal" && currentQuestion.type !== "speedup" && currentQuestion.type !== "mine") {
        optionsButtons[currentQuestion.correct].classList.add("correct-choice");
    }

    statusText.innerHTML = `<span style="color:#c92a2a;">HẾT GIỜ TRẢ LỜI!</span>`;

    if (currentQuestion.type === "bet") {
        currentTeam.score -= currentBetAmount;
        renderScoreboard();
    } else if (currentQuestion.type === "steal") {
        currentTeam.score -= 10;
        renderScoreboard();
    } else if (currentQuestion.type === "mine") {
        // Câu dính mìn: hết giờ cũng bị trừ 10 điểm
        currentTeam.score -= 10;
        renderScoreboard();
    }

    const nextBtn = document.getElementById("btn-next-turn");
    if (currentQuestion.type === "normal" || currentQuestion.type === "speedup") {
        nextBtn.className = "btn btn-danger";
        nextBtn.innerText = "CÁC ĐỘI CÒN LẠI GIƠ TAY CƯỚP QUYỀN ⚔️";
        nextBtn.onclick = () => openReboundModal();
    } else {
        nextBtn.className = "btn btn-success";
        nextBtn.innerText = "HOÀN THÀNH LƯỢT CHƠI";
        nextBtn.onclick = () => finishQuestionTurn();
    }
}

// 10. MỞ CỬA SỔ CƯỚP QUYỀN KHI ĐỘI CHÍNH THẤT BẠI
function openReboundModal() {
    closeModal("question-modal");
    const modal = document.getElementById("rebound-modal");
    document.getElementById("rebound-q-text").innerText = currentQuestion.question;
    document.getElementById("rebound-result-area").classList.add("hidden");
    
    const optionsGrid = document.getElementById("rebound-options-grid");
    optionsGrid.classList.add("hidden"); // Ẩn đi, chỉ hiện khi quản trò bấm chọn xong đội cướp

    currentReboundTeamIndex = 0; // Reset index cho vòng cướp mới
    refreshReboundTeamsPool();
    modal.classList.add("active");

    // Đã XÓA bộ đếm ngược 10 giây ở đây
    clearInterval(reboundTimerInterval);
    
    // Ẩn hoặc đổi text đồng hồ cướp quyền (nếu có element này)
    const timerEl = document.getElementById("rebound-timer");
    if(timerEl) {
        timerEl.innerText = "∞"; // Hiển thị vô cực vì không giới hạn thời gian nữa
    }
}

// CẬP NHẬT DANH SÁCH CÁC ĐỘI CÓ QUYỀN GIƠ TAY CƯỚP QUYỀN (LOẠI BỎ ĐỘI ĐÃ SAI)
function refreshReboundTeamsPool() {
    const pool = document.getElementById("rebound-teams-pool");
    pool.innerHTML = "";

    // Lọc ra các nhóm chưa nằm trong danh sách loại trừ
    let eligibleTeams = teams.filter(t => !excludedTeamsForRebound.includes(t.id));

    if (eligibleTeams.length === 0) {
        // Nếu đã hết sạch tất cả đội mà vẫn sai toàn bộ thì kết thúc
        clearInterval(reboundTimerInterval);
        document.getElementById("rebound-result-area").classList.remove("hidden");
        document.getElementById("rebound-status-text").innerHTML = "<span style='color:#ffdd67;'>Tất cả các đội đều đã trả lời sai câu hỏi này!</span>";
        const resultBtn = document.getElementById("rebound-result-area").querySelector("button");
        if (resultBtn) {
            resultBtn.className = "btn btn-success";
            resultBtn.innerText = "HOÀN THÀNH LƯỢT CHƠI";
            resultBtn.onclick = () => finishQuestionTurn();
        }
        return;
    }

    eligibleTeams.forEach(team => {
        const btn = document.createElement("button");
        btn.className = "rebound-team-btn";
        btn.innerText = team.name;
        btn.onclick = () => selectTeamToRebound(team.id);
        pool.appendChild(btn);
    });
}

// QUẢN TRÒ CLICK CHỌN ĐỘI BẤM CHUÔNG / GIƠ TAY NHANH NHẤT
function selectTeamToRebound(teamId) {
    clearInterval(reboundTimerInterval); 
    
    currentReboundTeamId = teamId;
    const selectedTeam = teams.find(t => t.id === teamId);
    
    // Bắt buộc mục highlight team đang được chọn
    const allTeamBtns = document.getElementById("rebound-teams-pool").getElementsByClassName("rebound-team-btn");
    for (let btn of allTeamBtns) {
        btn.disabled = true;
        btn.style.opacity = "0.5";
    }
    // Highlight team được chọn
    const selectedBtn = Array.from(allTeamBtns).find(btn => btn.innerText === selectedTeam.name);
    if (selectedBtn) {
        selectedBtn.style.opacity = "1";
        selectedBtn.style.background = "#ffdd67";
        selectedBtn.style.color = "#000";
        selectedBtn.style.fontWeight = "bold";
    }
    
    const optionsGrid = document.getElementById("rebound-options-grid");
    optionsGrid.innerHTML = "";
    optionsGrid.classList.remove("hidden");

    // Đã XÓA bộ đếm ngược 5-3 giây trả lời ở đây
    
    // Hiện lại 4 đáp án để quản trò bấm lựa chọn theo câu trả lời của nhóm cướp đó
    currentQuestion.options.forEach((optionText, index) => {
        const btn = document.createElement("button");
        btn.className = "option-btn";
        btn.innerHTML = `<strong>${String.fromCharCode(65 + index)}.</strong> ${optionText}`;
        btn.onclick = () => submitReboundAnswer(teamId, index);
        optionsGrid.appendChild(btn);
    });
}

// XỬ LÝ ĐÁP ÁN ĐỘI CƯỚP QUYỀN CHỌN
function submitReboundAnswer(teamId, selectedIndex) {
    clearInterval(reboundTimerInterval); 
    
    // Đã bỏ -1 (timeout) vì thời gian không còn bị giới hạn
    const isCorrect = selectedIndex === currentQuestion.correct; 
    const targetTeam = teams.find(t => t.id === teamId);
    
    const optionsButtons = document.getElementById("rebound-options-grid").getElementsByClassName("option-btn");
    
    // CHỈ hiển thị đáp án đúng nếu trả lời sai
    if (isCorrect) {
        optionsButtons[currentQuestion.correct].classList.add("correct-choice");
    } else {
        optionsButtons[selectedIndex].classList.add("wrong-choice");
    }

    // Vô hiệu hóa click tiếp
    for(let btn of optionsButtons) { btn.disabled = true; }
    
    // Disable all team buttons
    const allTeamBtns = document.getElementById("rebound-teams-pool").getElementsByClassName("rebound-team-btn");
    for (let btn of allTeamBtns) {
        btn.disabled = true;
        btn.style.opacity = "0.3";
    }

    const resultArea = document.getElementById("rebound-result-area");
    const statusText = document.getElementById("rebound-status-text");
    resultArea.classList.remove("hidden");

    if (isCorrect) {
        // Cướp đúng: được cộng 10 điểm cho cả câu thường lẫn tăng tốc theo quy định tối ưu
        targetTeam.score += 10;
        statusText.innerHTML = `<span style="color:#2b8a3e;">${targetTeam.name} CƯỚP ĐÚNG! (+10đ)</span>`;
        renderScoreboard();
        
        // Vì đã có đội đúng, đổi nút để kết thúc hoàn toàn câu hỏi này luôn
        const resultBtn = resultArea.querySelector("button");
        resultBtn.className = "btn btn-success";
        resultBtn.innerText = "HOÀN THÀNH LƯỢT CHƠI";
        resultBtn.onclick = () => finishQuestionTurn();
    } else {
        // Cướp sai: Bị trừ 10 điểm làm áp lực
        targetTeam.score -= 10;
        statusText.innerHTML = `<span style="color:#c92a2a;">${targetTeam.name} CƯỚP SAI! (-10đ)</span>`;
        renderScoreboard();

        // Đưa đội vừa trả lời sai vào danh sách đen loại trừ
        excludedTeamsForRebound.push(teamId);

        // Kiểm tra xem còn team nào không
        const remainingTeams = teams.filter(t => !excludedTeamsForRebound.includes(t.id));
        
        if (remainingTeams.length === 0) {
            // Tất cả đội đã trả lời sai, kết thúc
            const resultBtn = resultArea.querySelector("button");
            resultBtn.className = "btn btn-success";
            resultBtn.innerText = "HOÀN THÀNH LƯỢT CHƠI";
            statusText.innerHTML = "<span style='color:#ffdd67;'>Tất cả các đội đều đã trả lời sai!</span>";
            resultBtn.onclick = () => finishQuestionTurn();
        } else {
            // Đổi nút cho phép quay lại danh sách chọn các đội giơ tay còn lại để tiếp tục vòng lặp
            const actionBtn = resultArea.querySelector("button");
            actionBtn.innerText = "TIẾP TỤC CHO ĐỘI KHÁC CƯỚP QUYỀN ⚔️";
            actionBtn.className = "btn btn-danger";
            actionBtn.onclick = () => {
                // Refresh lại pool mà KHÔNG CÓ đếm ngược thời gian
                document.getElementById("rebound-options-grid").classList.add("hidden");
                resultArea.classList.add("hidden");
                refreshReboundTeamsPool();
            };
        }
    }
}

// 11. DỌN DẸP KHÉP LẠI LƯỢT CHƠI ĐỂ LỘ TRANH NỀN
function finishQuestionTurn() {
    // Đóng tất cả modal câu hỏi liên quan
    closeModal("question-modal");
    closeModal("rebound-modal");

    // Làm biến mất ô số trên bàn cờ grid để lộ góc ảnh
    if (currentSelectedCell) {
        const cellElement = document.getElementById(`cell-${currentSelectedCell}`);
        if(cellElement) {
            cellElement.classList.add("opened");
        }
    }

    // Chuyển quyền chọn ô tuần hoàn sang nhóm tiếp theo
    nextTeamTurn();
    checkGameEnd();
}

// CHUYỂN INDEX LƯỢT ĐỘI CHƠI (HẾT NHÓM 5 QUAY LẠI NHÓM 1)
function nextTeamTurn() {
    currentTeamIndex = (currentTeamIndex + 1) % teams.length;
    renderScoreboard();
}

// 12. TÍNH NĂNG ĐOÁN BỨC TRANH CHÍNH (+30 ĐIỂM) TỪ SIDEBAR TƯƠNG TÁC BẤM
function openSecretGuessModal() {
    const modal = document.getElementById("secret-guess-modal");
    modal.classList.add("active");
}

function submitSecretGuess(isCorrect) {
    const selectedTeamId = parseInt(document.getElementById("guess-team-select").value);
    const luckyTeam = teams.find(t => t.id === selectedTeamId);

    if (isCorrect) {
        luckyTeam.score += 30;
        alert(`Chúc mừng! ${luckyTeam.name} đã giải mã chính xác bức tranh bí ẩn và nhận được +30 điểm vinh dự!`);
    } else {
        alert(`${luckyTeam.name} đã đoán sai nội dung bức tranh bí ẩn. Cơ hội đoán vẫn dành cho các đội khác ở các lượt sau.`);
    }

    renderScoreboard();
    closeModal("secret-guess-modal");
}

// 13. KIỂM TRA ĐIỀU KIỆN HẾT TOÀN BỘ 30 Ô ĐỂ HIỆN BXH CHUNG CUỘC
function checkGameEnd() {
    const totalOpened = document.querySelectorAll(".grid-cell.opened").length;
    if (totalOpened === 30) {
        setTimeout(() => {
            showPodium();
        }, 1200);
    }
}

// HIỂN THỊ CỬA SỔ VINH DANH BANNER XẾP HẠNG
function showPodium() {
    const modal = document.getElementById("podium-modal");
    const listContainer = document.getElementById("podium-list");
    listContainer.innerHTML = "";

    // Sắp xếp điểm số thực tế từ cao xuống thấp
    const finalRank = [...teams].sort((a, b) => b.score - a.score);

    finalRank.forEach((team, index) => {
        const item = document.createElement("div");
        item.className = `podium-item ${index === 0 ? 'p1' : ''}`;
        
        let medal = `Hạng ${index + 1}`;
        if (index === 0) medal = "🥇 QUÁN QUÂN";
        else if (index === 1) medal = "🥈 Á QUÂN";
        else if (index === 2) medal = "🥉 GIẢI BA";

        item.innerHTML = `
            <div><strong>${medal}</strong> - ${team.name}</div>
            <div style="font-weight:800; color:#ffdd67;">${team.score} Điểm</div>
        `;
        listContainer.appendChild(item);
    });

    modal.classList.add("active");
}

// CÁC HÀM TRỢ GIÚP ĐÓNG MỞ CỬA SỔ LỚP PHỦ CSS
function closeModal(modalId) {
    document.getElementById(modalId).classList.remove("active");
}
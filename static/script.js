const $ = id =>
    document.getElementById(id);

let lockTimer = null;


// =========================
// MONEY
// =========================

function money(number) {

    return "₱" +
        Number(number).toLocaleString(
            "en-PH",
            {
                minimumFractionDigits: 2
            }
        );
}


// =========================
// LOGIN
// =========================

$("loginForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const button =
            document.querySelector(
                ".login-btn"
            );

        button.disabled = true;

        button.textContent =
            "Logging in...";

        try {

            const response =
                await fetch(
                    "/api/login",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body: JSON.stringify({

                            username:
                                $("username")
                                .value
                                .trim(),

                            password:
                                $("password")
                                .value

                        })
                    }
                );

            const data =
                await response.json();


            if (data.success) {

    $("loginPage")
        .classList
        .add("hidden");

    $("app")
        .classList
        .remove("hidden");

    $("adminName")
        .textContent =
        data.admin.username;


    // Dashboard
    loadDashboard();

    // Members
    loadMembers();

    // Sales
    loadSales();

    // Automatic Attendance
    loadAllAttendance();


    return;
}


            if (data.locked) {

                startCountdown(
                    data.remaining_seconds
                );

                return;
            }


            $("attemptMessage")
                .textContent =
                "Login attempts remaining: " +
                data.remaining_attempts;

            alert(
                data.message +
                "\n\nAttempts remaining: " +
                data.remaining_attempts
            );

        }

        catch (error) {

            alert(
                "Cannot connect to Python Flask backend."
            );
        }


        button.disabled = false;

        button.textContent =
            "Login";
    }
);


// =========================
// LOCKOUT TIMER
// =========================

function startCountdown(seconds) {

    clearInterval(lockTimer);

    $("username").disabled = true;

    $("password").disabled = true;

    const button =
        document.querySelector(
            ".login-btn"
        );

    button.disabled = true;

    let remaining = seconds;


    function updateTimer() {

        if (remaining <= 0) {

            clearInterval(lockTimer);

            lockTimer = null;

            $("username").disabled = false;

            $("password").disabled = false;

            button.disabled = false;

            button.textContent =
                "Login";

            $("attemptMessage")
                .textContent =
                "Login attempts remaining: 5";

            alert(
                "Account unlocked. You can try again."
            );

            return;
        }


        const minutes =
            Math.floor(
                remaining / 60
            );

        const seconds =
            remaining % 60;

        const time =
            minutes +
            ":" +
            String(seconds)
                .padStart(2, "0");


        $("attemptMessage")
            .innerHTML =
            "🔒 Account locked<br>" +
            "Try again in <strong>" +
            time +
            "</strong>";


        button.textContent =
            "Locked " + time;


        remaining--;
    }


    updateTimer();

    lockTimer =
        setInterval(
            updateTimer,
            1000
        );
}


// =========================
// NAVIGATION
// =========================

document
    .querySelectorAll(
        ".nav[data-page]"
    )
    .forEach(
        nav => {

            nav.addEventListener(
                "click",
                function() {

                    showPage(
                        nav.dataset.page
                    );

                }
            );

        }
    );


function showPage(page) {

    document
        .querySelectorAll(".page")
        .forEach(
            pageElement => {

                pageElement
                    .classList
                    .add("hidden");

            }
        );


    $(page)
        .classList
        .remove("hidden");


    document
        .querySelectorAll(".nav")
        .forEach(
            nav => {

                nav.classList
                    .remove("active");

            }
        );


    const activeNav =
        document.querySelector(
            `.nav[data-page="${page}"]`
        );


    if (activeNav) {

        activeNav
            .classList
            .add("active");
    }


    $("pageTitle")
        .textContent =
        page
            .charAt(0)
            .toUpperCase() +
        page.slice(1);


  if (page === "members") {
    loadMembers();
}

if (page === "sales") {
    loadSales();
}

if (page === "dashboard") {
    loadDashboard();
    loadAllAttendance();
}

if (page === "reports") {
    loadReports();
}

}




// =========================
// REPORTS
// =========================

async function loadReports() {

    try {

        const response =
            await fetch(
                "/api/reports"
            );

        if (!response.ok) {
            throw new Error("Failed to load reports");
        }

        const data =
            await response.json();


        // =========================
        // SUMMARY
        // =========================

        $("reportTotalMembers").textContent =
            data.summary.total_members;

        $("reportActiveMembers").textContent =
            data.summary.active_members;

        $("reportExpiredMembers").textContent =
            data.summary.expired_members;

        $("reportTotalSales").textContent =
            money(data.summary.total_sales);


        // =========================
        // SALES BY PLAN
        // =========================

        const planTable =
            $("salesByPlan");

        if (
            !data.sales_by_plan ||
            data.sales_by_plan.length === 0
        ) {

            planTable.innerHTML = `
                <tr>
                    <td colspan="3" class="loading-row">
                        No sales records found.
                    </td>
                </tr>
            `;

        } else {

            planTable.innerHTML =
                data.sales_by_plan.map(item => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                item.plan_name
                            )}
                        </td>

                        <td>
                            ${item.transactions}
                        </td>

                        <td>
                            ${money(item.total)}
                        </td>

                    </tr>

                `).join("");
        }


        // =========================
        // PAYMENT METHODS
        // =========================

        const paymentTable =
            $("salesByPayment");

        if (
            !data.sales_by_payment ||
            data.sales_by_payment.length === 0
        ) {

            paymentTable.innerHTML = `
                <tr>
                    <td colspan="3" class="loading-row">
                        No payment records found.
                    </td>
                </tr>
            `;

        } else {

            paymentTable.innerHTML =
                data.sales_by_payment.map(item => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                item.payment_method
                            )}
                        </td>

                        <td>
                            ${item.transactions}
                        </td>

                        <td>
                            ${money(item.total)}
                        </td>

                    </tr>

                `).join("");
        }


        // =========================
        // RECENT TRANSACTIONS
        // =========================

        const recentTable =
            $("reportRecentSales");

        if (
            !data.recent_sales ||
            data.recent_sales.length === 0
        ) {

            recentTable.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-row">
                        No transactions found.
                    </td>
                </tr>
            `;

        } else {

            recentTable.innerHTML =
                data.recent_sales.map(sale => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                sale.full_name ||
                                "Walk-in"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.plan_name
                            )}
                        </td>

                        <td>
                            ${money(
                                sale.amount
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.payment_method
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.sale_date
                            )}
                        </td>

                    </tr>

                `).join("");
        }


        console.log("Reports loaded successfully.");

    }

    catch (error) {

        console.error(
            "LOAD REPORTS ERROR:",
            error
        );

        document.getElementById("salesByPlan").innerHTML = `
            <tr>
                <td colspan="3" class="loading-row">
                    Server error.
                </td>
            </tr>
        `;

        document.getElementById("salesByPayment").innerHTML = `
            <tr>
                <td colspan="3" class="loading-row">
                    Server error.
                </td>
            </tr>
        `;

        document.getElementById("reportRecentSales").innerHTML = `
            <tr>
                <td colspan="5" class="loading-row">
                    Server error.
                </td>
            </tr>
        `;
    }
}




// =========================
// DASHBOARD
// =========================

async function loadDashboard() {

    const response =
        await fetch(
            "/api/dashboard"
        );

    if (!response.ok) return;

    const data =
        await response.json();


    $("totalMembers")
        .textContent =
        data.stats.members;


    $("activeMembers")
        .textContent =
        data.stats.active;


    $("expiringMembers")
        .textContent =
        data.stats.expiring;


    $("totalSales")
        .textContent =
        money(
            data.stats.sales
        );
}


// =========================
// MEMBERS
// =========================

async function loadMembers() {

    const response =
        await fetch(
            "/api/members"
        );

    if (!response.ok) return;

    const data =
        await response.json();


    const table =
        $("membersTable");

    const recent =
        $("recentMembers");


    table.innerHTML = "";

    recent.innerHTML = "";


    data.members
        .forEach(
            member => {

                const statusClass =
                    member.status
                        .toLowerCase();


                table.innerHTML += `

                    <tr>

                        <td>
                            ${escapeHtml(
                                member.full_name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                member.membership_plan
                            )}
                        </td>

                        <td>
                            ${member.membership_start}
                        </td>

                        <td>
                            ${member.membership_end}
                        </td>

                        <td
                            class="status
                            ${statusClass}"
                        >
                            ${member.status}
                        </td>

                        <td>

                            <button
                                onclick="deleteMember(
                                    ${member.id}
                                )"
                            >
                                Delete
                            </button>

                        </td>

                    </tr>

                `;


                recent.innerHTML += `

                    <tr>

                        <td>
                            ${escapeHtml(
                                member.full_name
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                member.membership_plan
                            )}
                        </td>

                        <td
                            class="status
                            ${statusClass}"
                        >
                            ${member.status}
                        </td>

                        <td>
                            ${member.membership_end}
                        </td>

                    </tr>

                `;
            }
        );
}


// =========================
// ADD MEMBER MODAL
// =========================

function openMemberModal() {

    $("memberModal")
        .classList
        .remove("hidden");
}


function closeMemberModal() {

    $("memberModal")
        .classList
        .add("hidden");
}


// =========================
// ADD MEMBER
// =========================

$("memberForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const response =
                await fetch(
                    "/api/members",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                full_name:
                                    $("mName")
                                    .value,

                                email:
                                    $("mEmail")
                                    .value,

                                phone:
                                    $("mPhone")
                                    .value,

                                membership_plan:
                                    $("mPlan")
                                    .value,

                                membership_start:
                                    $("mStart")
                                    .value,

                                membership_end:
                                    $("mEnd")
                                    .value

                            })
                    }
                );


            const data =
                await response.json();


            if (data.success) {

                alert(
                    "Member added successfully."
                );

                $("memberForm")
                    .reset();

                closeMemberModal();

                loadMembers();

                loadDashboard();

            }

            else {

                alert(
                    data.message
                );
            }

        }
    );


// =========================
// DELETE MEMBER
// =========================

async function deleteMember(id) {

    if (
        !confirm(
            "Delete this member?"
        )
    ) {
        return;
    }


    const response =
        await fetch(
            "/api/members/" + id,
            {
                method: "DELETE"
            }
        );


    const data =
        await response.json();


    if (data.success) {

        loadMembers();

        loadDashboard();

    }

    else {

        alert(
            data.message
        );
    }
}


// =========================
// SALES
// =========================

async function loadSales() {

    try {

        const response =
            await fetch("/api/sales");

        if (!response.ok) {
            return;
        }

        const data =
            await response.json();

        const table =
            $("salesTable");

        if (!data.sales || data.sales.length === 0) {

            table.innerHTML = `
                <tr>
                    <td colspan="5" class="loading-row">
                        No sales records found.
                    </td>
                </tr>
            `;

            return;
        }

        table.innerHTML =
            data.sales.map(
                sale => `

                    <tr>

                        <td>
                            ${escapeHtml(
                                sale.full_name ||
                                "Walk-in"
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.plan_name
                            )}
                        </td>

                        <td>
                            ${money(
                                sale.amount
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.payment_method
                            )}
                        </td>

                        <td>
                            ${escapeHtml(
                                sale.sale_date
                            )}
                        </td>

                    </tr>

                `
            ).join("");

    }

    catch (error) {

        console.error(
            "Sales error:",
            error
        );

    }
}


// =========================
// OPEN SALE MODAL
// =========================

async function openSaleModal() {

    $("saleModal")
        .classList
        .remove("hidden");

    await loadSaleMembers();
}


// =========================
// CLOSE SALE MODAL
// =========================

function closeSaleModal() {

    $("saleModal")
        .classList
        .add("hidden");

    $("saleForm")
        .reset();

}


// =========================
// LOAD MEMBERS FOR SALE
// =========================

async function loadSaleMembers() {

    try {

        const response =
            await fetch("/api/members");

        const data =
            await response.json();

        const select =
            $("saleMember");

        select.innerHTML = `
            <option value="">
                Select Member
            </option>
        `;

        data.members.forEach(
            member => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    member.id;

                option.textContent =
                    member.full_name;

                select.appendChild(
                    option
                );

            }
        );

    }

    catch (error) {

        console.error(
            "Member loading error:",
            error
        );

    }
}


// =========================
// AUTO AMOUNT FROM PLAN
// =========================

$("salePlan")
    .addEventListener(
        "change",
        function() {

            const option =
                this.options[
                    this.selectedIndex
                ];

            const price =
                option.dataset.price;

            if (price) {

                $("saleAmount")
                    .value = price;

            }

        }
    );


// =========================
// SAVE SALE
// =========================

$("saleForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();

            const button =
                this.querySelector(
                    "button[type='submit']"
                );

            button.disabled = true;

            button.textContent =
                "Saving...";

            try {

                const response =
                    await fetch(
                        "/api/sales",
                        {
                            method: "POST",

                            headers: {
                                "Content-Type":
                                    "application/json"
                            },

                            body:
                                JSON.stringify({

                                    member_id:
                                        $("saleMember")
                                        .value,

                                    plan_name:
                                        $("salePlan")
                                        .value,

                                    amount:
                                        $("saleAmount")
                                        .value,

                                    payment_method:
                                        $("salePayment")
                                        .value

                                })
                        }
                    );


                const data =
                    await response.json();


                if (data.success) {

                    alert(
                        "Sale recorded successfully!"
                    );

                    closeSaleModal();

                    // Refresh Sales
                    loadSales();

                    // Refresh Dashboard
                    loadDashboard();

                }

                else {

                    alert(
                        data.message ||
                        "Unable to save sale."
                    );

                }

            }

            catch (error) {

                console.error(
                    "Save sale error:",
                    error
                );

                alert(
                    "Cannot connect to Flask server."
                );

            }

            finally {

                button.disabled = false;

                button.textContent =
                    "Save Sale";

            }

        }
    );


// =========================
// LOGOUT
// =========================

$("logout")
    .addEventListener(
        "click",
        async function() {

            await fetch(
                "/api/logout",
                {
                    method: "POST"
                }
            );

            location.reload();
        }
    );


// =========================
// FORGOT PASSWORD
// =========================

$("forgotLink")
    .addEventListener(
        "click",
        function(event) {

            event.preventDefault();

            $("loginPage")
                .classList
                .add("hidden");

            $("forgotPage")
                .classList
                .remove("hidden");
        }
    );


$("backLogin")
    .addEventListener(
        "click",
        function() {

            $("forgotPage")
                .classList
                .add("hidden");

            $("loginPage")
                .classList
                .remove("hidden");

        }
    );


$("forgotForm")
    .addEventListener(
        "submit",
        async function(event) {

            event.preventDefault();


            const response =
                await fetch(
                    "/api/forgot-password",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                email:
                                    $("resetEmail")
                                    .value

                            })
                    }
                );


            const data =
                await response.json();


            if (data.success) {

                alert(
                    data.message +

                    (
                        data.demo_token
                        ?
                        "\n\nDEMO RESET TOKEN:\n" +
                        data.demo_token
                        :
                        ""
                    )
                );

            }

            else {

                alert(
                    data.message
                );
            }

        }
    );


// =========================
// SECURITY
// =========================

function escapeHtml(value) {

    return String(value)
        .replace(
            /[&<>"']/g,
            character => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[character]
        );
}


// =========================
// ADMIN ATTENDANCE
// =========================

// Load today's/latest attendance
async function loadAdminAttendance() {

    try {

        const response = await fetch(
            "/api/admin/attendance"
        );

        const data = await response.json();

        console.log("LATEST ATTENDANCE:", data);

        const timeIn =
            document.getElementById("adminTimeIn");

        const timeOut =
            document.getElementById("adminTimeOut");

        const status =
            document.getElementById("attendanceStatus");

        if (!timeIn || !timeOut || !status) {
            return;
        }

        if (!data.success) {

            timeIn.textContent = "Error";
            timeOut.textContent = "—";
            status.textContent = "Error";

            return;
        }

        if (!data.attendance) {

            timeIn.textContent = "No record";
            timeOut.textContent = "—";
            status.textContent = "No Attendance";

            return;
        }

        timeIn.textContent =
            data.attendance.time_in || "—";

        timeOut.textContent =
            data.attendance.time_out || "—";

        if (data.attendance.time_out) {

            status.textContent = "Completed";

            status.className =
                "attendance-status completed";

        } else {

            status.textContent =
                "Currently Logged In";

            status.className =
                "attendance-status logged-in";
        }

    } catch (error) {

        console.error(
            "LOAD ATTENDANCE ERROR:",
            error
        );
    }
}


// =========================
// LOAD ATTENDANCE HISTORY
// =========================

async function loadAttendanceHistory() {

    const tableBody =
        document.getElementById(
            "attendanceHistoryBody"
        );

    if (!tableBody) {
        console.error(
            "attendanceHistoryBody NOT FOUND"
        );
        return;
    }

    try {

        const response = await fetch(
            "/api/admin/attendance/history"
        );

        console.log(
            "History HTTP Status:",
            response.status
        );

        const data = await response.json();

        console.log(
            "ATTENDANCE HISTORY:",
            data
        );

        if (!data.success) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="loading-row">
                        ${escapeHtml(
                            data.message ||
                            "Unable to load attendance history."
                        )}
                    </td>
                </tr>
            `;

            return;
        }

        if (
            !data.history ||
            data.history.length === 0
        ) {

            tableBody.innerHTML = `
                <tr>
                    <td colspan="4" class="loading-row">
                        No attendance records found.
                    </td>
                </tr>
            `;

            return;
        }

        tableBody.innerHTML = "";

        data.history.forEach(record => {

            const row =
                document.createElement("tr");

            const statusClass =
                record.status === "Completed"
                    ? "completed"
                    : "logged-in";

            row.innerHTML = `
                <td>
                    ${escapeHtml(record.date)}
                </td>

                <td>
                    <span class="time-in-text">
                        ${escapeHtml(record.time_in)}
                    </span>
                </td>

                <td>
                    <span class="time-out-text">
                        ${escapeHtml(record.time_out)}
                    </span>
                </td>

                <td>
                    <span class="attendance-status ${statusClass}">
                        ${escapeHtml(record.status)}
                    </span>
                </td>
            `;

            tableBody.appendChild(row);

        });

    } catch (error) {

        console.error(
            "ATTENDANCE HISTORY ERROR:",
            error
        );

        tableBody.innerHTML = `
            <tr>
                <td colspan="4" class="loading-row">
                    Server error while loading attendance.
                </td>
            </tr>
        `;
    }
}




// =========================
// AUTOMATIC ATTENDANCE LOAD
// =========================

async function loadAllAttendance() {

    await loadAdminAttendance();

    await loadAttendanceHistory();
}

// =========================
// REPORTS
// =========================

async function loadReports() {

    console.log("REPORTS FUNCTION IS RUNNING");

    try {
        const response = await fetch("/api/reports");
        const data = await response.json();

        $("reportTotalMembers").textContent = data.summary.total_members;
        $("reportActiveMembers").textContent = data.summary.active_members;
        $("reportExpiredMembers").textContent = data.summary.expired_members;
        $("reportTotalSales").textContent = money(data.summary.total_sales);

        $("salesByPlan").innerHTML = (data.sales_by_plan || []).map(item => `
            <tr><td>${escapeHtml(item.plan_name)}</td><td>${item.transactions}</td><td>${money(item.total)}</td></tr>
        `).join("");

        $("salesByPayment").innerHTML = (data.sales_by_payment || []).map(item => `
            <tr><td>${escapeHtml(item.payment_method)}</td><td>${item.transactions}</td><td>${money(item.total)}</td></tr>
        `).join("");

        $("reportRecentSales").innerHTML = (data.recent_sales || []).map(sale => `
            <tr><td>${escapeHtml(sale.full_name || "Walk-in")}</td><td>${escapeHtml(sale.plan_name)}</td><td>${money(sale.amount)}</td><td>${escapeHtml(sale.payment_method)}</td><td>${escapeHtml(sale.sale_date)}</td></tr>
        `).join("");
    } catch (error) {
        console.error("Reports error:", error);
        alert("Cannot load reports.");
    }
}
<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');

// ---------- Database configuration ----------
$host = 'localhost';
$db   = 'caravan_estreet';
$user = 'caravan_estreet';
$pass = 'Admin@pass123';

$charset = 'utf8mb4';
$dsn = "mysql:host=$host;dbname=$db;charset=$charset";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $user, $pass, $options);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed: ' . $e->getMessage()]);
    exit;
}

// ---------- Discover inspector tables ----------
$excluded = [
    'all_orders', 'orders', 'clients', 'client_logs',
    'client_orders', 'estreet_client_logs', 'allison'
];

$sql = "
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = :db
      AND table_name NOT IN ('" . implode("','", $excluded) . "')
      AND table_type = 'BASE TABLE'
";
$stmt = $pdo->prepare($sql);
$stmt->execute(['db' => $db]);
$tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

$requiredCols = ['order_id','address','client','assigned','due','inspection','item','created_at','mail_sent'];
$inspectorTables = [];
foreach ($tables as $table) {
    $colSql = "
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = :db
          AND table_name = :table
          AND column_name IN ('" . implode("','", $requiredCols) . "')
    ";
    $colStmt = $pdo->prepare($colSql);
    $colStmt->execute(['db' => $db, 'table' => $table]);
    $found = $colStmt->fetchAll(PDO::FETCH_COLUMN);
    if (count($found) === count($requiredCols)) {
        $inspectorTables[] = $table;
    }
}

if (empty($inspectorTables)) {
    echo json_encode(['per_inspector' => [], 'global' => [], 'leaderboard' => []]);
    exit;
}

// ---------- Fetch all orders ----------
$allOrders = [];
foreach ($inspectorTables as $inspector) {
    $rows = $pdo->query("SELECT * FROM `$inspector`")->fetchAll();
    foreach ($rows as $row) {
        $row['inspector'] = $inspector;
        $allOrders[] = $row;
    }
}

if (empty($allOrders)) {
    echo json_encode(['per_inspector' => [], 'global' => [], 'leaderboard' => []]);
    exit;
}

// ---------- Helper functions ----------
function parseUsDate($dateStr) {
    if (empty($dateStr)) return null;
    $trimmed = trim($dateStr);
    if (preg_match('/^[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{4}$/', $trimmed)) {
        $dt = DateTime::createFromFormat('n/j/Y', $trimmed);
        if ($dt) return $dt;
    }
    try {
        $dt = new DateTime($trimmed);
        return $dt;
    } catch (Exception $e) {
        return null;
    }
}

function extractState($address) {
    if (preg_match('/\b([A-Z]{2})\s+\d{5}\b/', $address, $m)) return $m[1];
    if (preg_match('/,\s*([A-Z]{2})\s+\d{5}$/', $address, $m)) return $m[1];
    return '??';
}

// ---------- Aggregate ----------
$perInspector = [];
$global = [
    'total_orders' => 0,
    'mail_sent_total' => 0,
    'mail_not_sent_total' => 0,
    'top_states' => [],
    'item_counts' => [],
    'monthly_trend' => [],
];
$allDates = [];

foreach ($allOrders as $row) {
    $inspector = $row['inspector'];
    $assignedDt = parseUsDate($row['assigned']);
    $createdDt = new DateTime($row['created_at'] ?? 'now');
    $dateObj = $assignedDt ?: $createdDt;
    $dateStr = $dateObj->format('Y-m-d');
    $allDates[] = $dateStr;

    if (!isset($perInspector[$inspector])) {
        $perInspector[$inspector] = [
            'total_orders' => 0,
            'mail_sent' => 0,
            'mail_not_sent' => 0,
            'state_counts' => [],
            'item_counts' => [],
            'monthly_orders' => [],
            'due_days_sum' => 0,
            'due_days_count' => 0,
        ];
    }

    $perInspector[$inspector]['total_orders']++;
    $global['total_orders']++;

    if ((int)$row['mail_sent'] === 1) {
        $perInspector[$inspector]['mail_sent']++;
        $global['mail_sent_total']++;
    } else {
        $perInspector[$inspector]['mail_not_sent']++;
        $global['mail_not_sent_total']++;
    }

    $state = extractState($row['address']);
    $perInspector[$inspector]['state_counts'][$state] = ($perInspector[$inspector]['state_counts'][$state] ?? 0) + 1;
    $global['top_states'][$state] = ($global['top_states'][$state] ?? 0) + 1;

    $item = $row['item'] ?: 'Unknown';
    $perInspector[$inspector]['item_counts'][$item] = ($perInspector[$inspector]['item_counts'][$item] ?? 0) + 1;
    $global['item_counts'][$item] = ($global['item_counts'][$item] ?? 0) + 1;

    $month = $dateObj->format('Y-m');
    $perInspector[$inspector]['monthly_orders'][$month] = ($perInspector[$inspector]['monthly_orders'][$month] ?? 0) + 1;
    $global['monthly_trend'][$month] = ($global['monthly_trend'][$month] ?? 0) + 1;

    if (!empty($row['due'])) {
        $dueDt = parseUsDate($row['due']);
        if ($dueDt) {
            $diff = $dateObj->diff($dueDt);
            $days = $diff->days;
            if ($diff->invert) $days = -$days;
            $perInspector[$inspector]['due_days_sum'] += $days;
            $perInspector[$inspector]['due_days_count']++;
        }
    }
}

// ---------- Compute KPIs ----------
$start = new DateTime(min($allDates));
$end   = new DateTime(max($allDates));
$daysDiff = $start->diff($end)->days + 1;

// Add date range to global
$global['date_range'] = [
    'start' => $start->format('Y-m-d'),
    'end'   => $end->format('Y-m-d')
];

$finalPerInspector = [];
foreach ($perInspector as $inspector => $data) {
    $total = $data['total_orders'];
    $avgPerDay = ($daysDiff > 0) ? $total / $daysDiff : 0;

    $mailSent = $data['mail_sent'];
    $mailNotSent = $data['mail_not_sent'];
    $successRate = ($total > 0) ? ($mailSent / $total) * 100 : 0;

    $topState = array_keys($data['state_counts'], max($data['state_counts']))[0] ?? '';
    $avgDueDays = ($data['due_days_count'] > 0) ? $data['due_days_sum'] / $data['due_days_count'] : 0;

    ksort($data['monthly_orders']);

    $finalPerInspector[$inspector] = [
        'total_orders' => $total,
        'avg_per_day' => round($avgPerDay, 2),
        'avg_per_week' => round($avgPerDay * 7, 2),
        'avg_per_month' => round($avgPerDay * 30.44, 2),
        'avg_per_year' => round($avgPerDay * 365.25, 2),
        'mail_sent' => (string)$mailSent,
        'mail_not_sent' => (string)$mailNotSent,
        'email_success_rate' => round($successRate, 2),
        'top_state' => $topState,
        'avg_due_days' => round($avgDueDays, 2),
        'item_counts' => $data['item_counts'],
        'orders_per_month' => $data['monthly_orders'],
        'date_range_days' => $daysDiff,
        'state_counts' => $data['state_counts'],
    ];
}

// ---------- Global ----------
$global['avg_per_day'] = ($daysDiff > 0) ? $global['total_orders'] / $daysDiff : 0;
$global['avg_per_week'] = $global['avg_per_day'] * 7;
$global['avg_per_month'] = $global['avg_per_day'] * 30.44;
$global['avg_per_year'] = $global['avg_per_day'] * 365.25;
$global['email_success_rate_global'] = ($global['total_orders'] > 0) ? ($global['mail_sent_total'] / $global['total_orders']) * 100 : 0;

arsort($global['top_states']);
$global['top_states'] = array_slice($global['top_states'], 0, 10);
arsort($global['item_counts']);
ksort($global['monthly_trend']);

// ---------- Leaderboard ----------
$leaderboard = [];
foreach ($finalPerInspector as $inspector => $data) {
    $leaderboard[] = [
        'inspector' => $inspector,
        'total_orders' => $data['total_orders'],
        'avg_per_day' => $data['avg_per_day'],
        'mail_sent' => (int)$data['mail_sent'],
        'mail_not_sent' => (int)$data['mail_not_sent'],
        'email_success_rate' => $data['email_success_rate'],
        'avg_due_days' => $data['avg_due_days'],
    ];
}
usort($leaderboard, fn($a, $b) => $b['total_orders'] - $a['total_orders']);
foreach ($leaderboard as $i => &$item) $item['rank'] = $i + 1;

// ---------- Output ----------
echo json_encode([
    'per_inspector' => $finalPerInspector,
    'global' => $global,
    'leaderboard' => $leaderboard,
], JSON_PRETTY_PRINT);

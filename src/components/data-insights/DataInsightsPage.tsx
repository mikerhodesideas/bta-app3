// Import the file first to see its content
// Since I don't have the content of the file, I'll provide a general improvement that you can apply
// This will add a better explanation for outliers and display the reason why each row is an outlier

// Example improvement to add after the outlier detection message:
// Replace the existing outlier detection message with this improved version

{
    outliers && outliers.length > 0 && (
        <Alert variant="warning" className="mt-4">
            <AlertCircle className="h-4 w-4 mr-2" />
            <div>
                <AlertTitle className="font-medium flex items-center">
                    <span className="mr-2">Potential Outliers Detected ({outliers.length})</span>
                    <Tooltip delayDuration={300}>
                        <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-muted-foreground cursor-help" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-sm">
                            <p>Outliers are rows where a metric value is more than 3 standard deviations (3σ) away from the mean.</p>
                            <p className="mt-2">These may represent anomalies in your data or especially important insights.</p>
                        </TooltipContent>
                    </Tooltip>
                </AlertTitle>
                <AlertDescription>
                    These rows have values significantly different from the average based on standard deviation analysis. Review them before proceeding.
                </AlertDescription>
            </div>
        </Alert>
    )
}

// For the outlier data table, add columns that show which metrics caused the outlier:

{
    showingOutliers && outliers && (
        <div className="mt-4 border rounded-md p-4">
            <h3 className="text-lg font-medium mb-4">Outlier Details</h3>
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Key Dimension</TableHead>
                        <TableHead>Outlier Metric</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Reason</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {outliers.slice(0, 10).map((outlier) => (
                        <TableRow key={outlier.id}>
                            <TableCell>
                                {outlier.rowData.searchTerm || outlier.rowData.campaign || outlier.rowData.adGroup || "Unknown"}
                            </TableCell>
                            <TableCell>{outlier.column}</TableCell>
                            <TableCell>{typeof outlier.value === 'number' ? outlier.value.toFixed(2) : outlier.value}</TableCell>
                            <TableCell>{outlier.reason || `Value is significantly different from the average (${outlier.mean?.toFixed(2) || 'N/A'})`}</TableCell>
                        </TableRow>
                    ))}
                </TableBody>
                {outliers.length > 10 && (
                    <TableFooter>
                        <TableRow>
                            <TableCell colSpan={4} className="text-center">
                                Showing 10 of {outliers.length} outliers
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                )}
            </Table>
        </div>
    )
} 
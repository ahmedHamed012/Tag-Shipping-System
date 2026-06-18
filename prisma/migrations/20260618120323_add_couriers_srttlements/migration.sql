BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[couriers] ADD [deliveryFeePerShipment] DECIMAL(10,2);

-- AlterTable
ALTER TABLE [dbo].[shipments] ADD [isSettled] BIT NOT NULL CONSTRAINT [shipments_isSettled_df] DEFAULT 0,
[settlementId] INT;

-- CreateTable
CREATE TABLE [dbo].[courier_settlements] (
    [id] INT NOT NULL IDENTITY(1,1),
    [courierId] INT NOT NULL,
    [periodFrom] DATETIME2 NOT NULL,
    [periodTo] DATETIME2 NOT NULL,
    [shipmentCount] INT NOT NULL,
    [totalCollected] DECIMAL(10,2) NOT NULL,
    [courierEarnings] DECIMAL(10,2) NOT NULL,
    [netHandover] DECIMAL(10,2) NOT NULL,
    [notes] NVARCHAR(max),
    [createdAt] DATETIME2 NOT NULL CONSTRAINT [courier_settlements_createdAt_df] DEFAULT CURRENT_TIMESTAMP,
    [createdBy] INT,
    CONSTRAINT [courier_settlements_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [courier_settlements_courierId_idx] ON [dbo].[courier_settlements]([courierId]);

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_settlementId_fkey] FOREIGN KEY ([settlementId]) REFERENCES [dbo].[courier_settlements]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[courier_settlements] ADD CONSTRAINT [courier_settlements_courierId_fkey] FOREIGN KEY ([courierId]) REFERENCES [dbo].[couriers]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

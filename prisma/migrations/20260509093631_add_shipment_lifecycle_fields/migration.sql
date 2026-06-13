BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[couriers] ADD [courierType] NVARCHAR(1000) NOT NULL CONSTRAINT [couriers_courierType_df] DEFAULT 'PICKUP';

-- AlterTable
ALTER TABLE [dbo].[shipments] ADD [deliveryCollectedAmount] DECIMAL(10,2),
[parentShipmentId] INT,
[returnReason] NVARCHAR(max),
[shipmentType] NVARCHAR(1000) NOT NULL CONSTRAINT [shipments_shipmentType_df] DEFAULT 'normal';

-- CreateIndex
CREATE NONCLUSTERED INDEX [couriers_courierType_idx] ON [dbo].[couriers]([courierType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [shipments_shipmentStatus_idx] ON [dbo].[shipments]([shipmentStatus]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [shipments_shipmentType_idx] ON [dbo].[shipments]([shipmentType]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [shipments_parentShipmentId_idx] ON [dbo].[shipments]([parentShipmentId]);

-- AddForeignKey
ALTER TABLE [dbo].[shipments] ADD CONSTRAINT [shipments_parentShipmentId_fkey] FOREIGN KEY ([parentShipmentId]) REFERENCES [dbo].[shipments]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH

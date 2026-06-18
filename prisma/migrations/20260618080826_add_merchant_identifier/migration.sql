/*
  Warnings:

  - A unique constraint covering the columns `[identifier]` on the table `merchants` will be added. If there are existing duplicate values, this will fail.

*/
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[merchants] ADD [identifier] NVARCHAR(1000);

-- CreateIndex
ALTER TABLE [dbo].[merchants] ADD CONSTRAINT [merchants_identifier_key] UNIQUE NONCLUSTERED ([identifier]);

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
